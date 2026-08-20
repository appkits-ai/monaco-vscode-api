/**
 * 把 VS Code 文件操作接到 /home/agent，并补齐缺失的可选 .vscode JSON。
 * Bridges VS Code file operations to /home/agent and fills missing optional .vscode JSON.
 *
 * @owner appkits-editor
 * @module vscode-editor
 */
import * as appkits from "@appkits-ai/sdk/client";
import {
  FileChangeType,
  FileSystemProviderCapabilities,
  FileSystemProviderError,
  FileSystemProviderErrorCode,
  FileType,
  type IFileChange,
  type IFileDeleteOptions,
  type IFileOverwriteOptions,
  type IFileSystemProviderWithFileReadWriteCapability,
  type IFileWriteOptions,
  type IStat,
  type IWatchOptions,
} from "@codingame/monaco-vscode-files-service-override";

export const APPKITS_WORKSPACE_ROOT = "/home/agent";
export const APPKITS_WORKSPACE_FILE = "/appkits.code-workspace";
export const APPKITS_VSCODE_DIR = `${APPKITS_WORKSPACE_ROOT}/.vscode`;
export const APPKITS_VSCODE_OPTIONAL_FILES = [
  "settings.json",
  "tasks.json",
  "launch.json",
  "extensions.json",
  "mcp.json",
] as const;

export interface AppKitsFileEntry {
  path: string;
  name?: string;
  kind?: "file" | "directory";
  contentType?: string;
  size?: number;
}

interface CachedEntry {
  path: string;
  name: string;
  type: FileType;
  size: number;
  mtime: number;
  ctime: number;
  contentType?: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface DisposableLike {
  dispose(): void;
}

interface ResourceUri {
  path: string;
}

type EventLike<T> = (listener: (event: T) => unknown) => DisposableLike;

class SimpleEmitter<T> {
  private readonly listeners = new Set<(event: T) => unknown>();

  readonly event: EventLike<T> = (listener) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };

  fire(event: T): void {
    for (const listener of this.listeners) listener(event);
  }
}

export class AppKitsFileSystemProvider
  implements IFileSystemProviderWithFileReadWriteCapability
{
  readonly capabilities =
    FileSystemProviderCapabilities.FileReadWrite |
    FileSystemProviderCapabilities.PathCaseSensitive;

  readonly onDidChangeCapabilities = new SimpleEmitter<void>().event;

  private readonly changes = new SimpleEmitter<readonly IFileChange[]>();
  readonly onDidChangeFile = this.changes.event;

  private readonly directoryCache = new Map<string, CachedEntry[]>();
  private readonly fileStatCache = new Map<string, CachedEntry>();
  private readonly now = Date.now();

  watch(_resource: ResourceUri, _opts: IWatchOptions): DisposableLike {
    return { dispose() {} };
  }

  async stat(resource: ResourceUri): Promise<IStat> {
    const path = normalizePath(resource.path);
    if (path === APPKITS_WORKSPACE_FILE) {
      return statForEntry(this.workspaceFileEntry());
    }
    if (path === "/" || path === APPKITS_WORKSPACE_ROOT) {
      return statForEntry(directoryEntry(path));
    }
    const parent = dirname(path);
    const entries = await this.list(parent);
    const entry = entries.find((item) => item.path === path);
    if (entry) return statForEntry(entry);
    const optional = optionalVscodeEntry(path);
    if (optional) return statForEntry(optional);
    throw providerError("File not found", FileSystemProviderErrorCode.FileNotFound);
  }

  async readdir(resource: ResourceUri): Promise<[string, FileType][]> {
    const path = normalizePath(resource.path);
    if (path === "/") return [["home", FileType.Directory]];
    if (path === "/home") return [["agent", FileType.Directory]];
    if (path === APPKITS_WORKSPACE_FILE) {
      throw providerError("File is not a directory", FileSystemProviderErrorCode.FileNotADirectory);
    }
    const entries = await this.list(path);
    return entries.map((entry) => [entry.name, entry.type]);
  }

  async readFile(resource: ResourceUri): Promise<Uint8Array> {
    const path = normalizePath(resource.path);
    if (path === APPKITS_WORKSPACE_FILE) return workspaceFileBytes();
    try {
      const file = await appkits.FileSystem.read(path);
      if (typeof file.bodyBase64 === "string") return base64ToBytes(file.bodyBase64);
      return textEncoder.encode(typeof file.body === "string" ? file.body : "");
    } catch (error) {
      if (optionalVscodeFileName(path)) return emptyJsonBytes();
      throw providerError(errorMessage(error), FileSystemProviderErrorCode.FileNotFound);
    }
  }

  async writeFile(
    resource: ResourceUri,
    content: Uint8Array,
    opts: IFileWriteOptions,
  ): Promise<void> {
    const path = normalizePath(resource.path);
    if (path === APPKITS_WORKSPACE_FILE) {
      throw providerError("Workspace file is read-only", FileSystemProviderErrorCode.NoPermissions);
    }
    if (!opts.overwrite) {
      try {
        await this.stat(resource);
        throw providerError("File exists", FileSystemProviderErrorCode.FileExists);
      } catch (error) {
        if (!isProviderCode(error, FileSystemProviderErrorCode.FileNotFound)) throw error;
      }
    }
    await appkits.FileSystem.write({
      path,
      bodyBase64: bytesToBase64(content),
      contentType: contentTypeForPath(path),
    });
    this.invalidate(dirname(path));
    this.fileStatCache.set(path, fileEntry(path, content.length));
    this.fire(path, FileChangeType.UPDATED);
  }

  async mkdir(resource: ResourceUri): Promise<void> {
    const path = normalizePath(resource.path);
    await appkits.FileSystem.mkdir(path);
    this.invalidate(dirname(path));
    this.fire(path, FileChangeType.ADDED);
  }

  async delete(resource: ResourceUri, _opts: IFileDeleteOptions): Promise<void> {
    const path = normalizePath(resource.path);
    await appkits.FileSystem.delete(path);
    this.invalidate(dirname(path));
    this.fileStatCache.delete(path);
    this.fire(path, FileChangeType.DELETED);
  }

  async rename(
    from: ResourceUri,
    to: ResourceUri,
    _opts: IFileOverwriteOptions,
  ): Promise<void> {
    const fromPath = normalizePath(from.path);
    const toPath = normalizePath(to.path);
    await appkits.FileSystem.move(fromPath, toPath);
    this.invalidate(dirname(fromPath));
    this.invalidate(dirname(toPath));
    this.fileStatCache.delete(fromPath);
    this.fire(fromPath, FileChangeType.DELETED);
    this.fire(toPath, FileChangeType.ADDED);
  }

  private async list(path: string): Promise<CachedEntry[]> {
    const normalized = normalizePath(path);
    if (!normalized.startsWith(APPKITS_WORKSPACE_ROOT)) return [];
    const cached = this.directoryCache.get(normalized);
    if (cached) return cached;
    let entries: CachedEntry[] = [];
    try {
      const result = await appkits.FileSystem.list(normalized);
      entries = (Array.isArray(result.entries) ? result.entries : [])
        .map((entry) => normalizeEntry(entry))
        .filter((entry): entry is CachedEntry => Boolean(entry));
    } catch (error) {
      if (normalized !== APPKITS_VSCODE_DIR) throw error;
    }
    mergeOptionalVscodeEntries(normalized, entries);
    this.directoryCache.set(normalized, entries);
    for (const entry of entries) this.fileStatCache.set(entry.path, entry);
    return entries;
  }

  private workspaceFileEntry(): CachedEntry {
    return {
      path: APPKITS_WORKSPACE_FILE,
      name: "appkits.code-workspace",
      type: FileType.File,
      size: workspaceFileBytes().byteLength,
      ctime: this.now,
      mtime: this.now,
      contentType: "application/json",
    };
  }

  private invalidate(path: string): void {
    this.directoryCache.delete(normalizePath(path));
  }

  private fire(path: string, type: FileChangeType): void {
    this.changes.fire([
      { resource: uriFile(path), type },
    ] as unknown as readonly IFileChange[]);
  }
}

function normalizeEntry(entry: unknown): CachedEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const value = entry as AppKitsFileEntry;
  if (typeof value.path !== "string" || !value.path) return null;
  const path = normalizePath(value.path);
  return {
    path,
    name: value.name || basename(path),
    type: value.kind === "directory" ? FileType.Directory : FileType.File,
    size: typeof value.size === "number" ? value.size : 0,
    ctime: Date.now(),
    mtime: Date.now(),
    contentType: value.contentType,
  };
}

function statForEntry(entry: CachedEntry): IStat {
  return {
    type: entry.type,
    ctime: entry.ctime,
    mtime: entry.mtime,
    size: entry.size,
  };
}

function directoryEntry(path: string): CachedEntry {
  return { path, name: basename(path), type: FileType.Directory, size: 0, ctime: Date.now(), mtime: Date.now() };
}

function fileEntry(path: string, size: number): CachedEntry {
  return { path, name: basename(path), type: FileType.File, size, ctime: Date.now(), mtime: Date.now() };
}

function workspaceFileBytes(): Uint8Array {
  return textEncoder.encode(
    JSON.stringify({ folders: [{ path: APPKITS_WORKSPACE_ROOT }] }, null, 2),
  );
}

function normalizePath(path: string): string {
  const unified = path.replace(/\\/g, "/");
  const prefixed = unified.startsWith("/") ? unified : `/${unified}`;
  return prefixed.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

/** 返回空 JSON 文档字节。 Returns empty JSON document bytes. */
function emptyJsonBytes(): Uint8Array {
  return textEncoder.encode("{}\n");
}

/**
 * 若路径是可选的 VS Code 配置文件则返回文件名。
 * Returns the filename when the path is an optional VS Code config file.
 */
function optionalVscodeFileName(path: string): string | undefined {
  if (!path.startsWith(`${APPKITS_VSCODE_DIR}/`)) return undefined;
  const name = path.slice(APPKITS_VSCODE_DIR.length + 1);
  return APPKITS_VSCODE_OPTIONAL_FILES.find((file) => file === name);
}

/**
 * 为缺失的 .vscode 目录或可选 JSON 构造虚拟条目。
 * Builds a virtual entry for a missing .vscode directory or optional JSON file.
 */
function optionalVscodeEntry(path: string): CachedEntry | null {
  if (path === APPKITS_VSCODE_DIR) return directoryEntry(path);
  const name = optionalVscodeFileName(path);
  if (!name) return null;
  return fileEntry(path, emptyJsonBytes().byteLength);
}

/**
 * 在 Computer 未给出 .vscode 时补上目录和可选 JSON。
 * Adds the .vscode directory and optional JSON when Computer does not list them.
 */
function mergeOptionalVscodeEntries(path: string, entries: CachedEntry[]): void {
  if (path === APPKITS_WORKSPACE_ROOT) {
    if (!entries.some((entry) => entry.path === APPKITS_VSCODE_DIR)) {
      entries.push(directoryEntry(APPKITS_VSCODE_DIR));
    }
    return;
  }
  if (path !== APPKITS_VSCODE_DIR) return;
  for (const name of APPKITS_VSCODE_OPTIONAL_FILES) {
    const filePath = `${APPKITS_VSCODE_DIR}/${name}`;
    if (!entries.some((entry) => entry.path === filePath)) {
      entries.push(fileEntry(filePath, emptyJsonBytes().byteLength));
    }
  }
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

function basename(path: string): string {
  return normalizePath(path).split("/").filter(Boolean).at(-1) || "/";
}

function uriFile(path: string): ResourceUri {
  return { path: normalizePath(path) };
}

function contentTypeForPath(path: string): string {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".md")) return "text/markdown";
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "text/typescript";
  return "text/plain;charset=UTF-8";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function providerError(message: string, code: FileSystemProviderErrorCode): Error {
  return FileSystemProviderError.create(message, code);
}

function isProviderCode(error: unknown, code: FileSystemProviderErrorCode): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === code);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "AppKits file system request failed.";
}

export function decodeUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}
