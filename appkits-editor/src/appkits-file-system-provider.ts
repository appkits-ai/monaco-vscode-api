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
import {
  APPKITS_WORKSPACE_FILE,
  APPKITS_WORKSPACE_PRESENTATION_ROOT,
  APPKITS_WORKSPACE_ROOT,
  normalizeAppKitsPath,
} from "./appkits-paths";

export {
  APPKITS_WORKSPACE_FILE,
  APPKITS_WORKSPACE_PRESENTATION_ROOT,
  APPKITS_WORKSPACE_ROOT,
};

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
    if (
      path === "/" ||
      path === APPKITS_WORKSPACE_PRESENTATION_ROOT ||
      path === APPKITS_WORKSPACE_ROOT
    ) {
      return statForEntry(directoryEntry(path));
    }
    const parent = dirname(path);
    const entries = await this.list(parent);
    const entry = entries.find((item) => item.path === path);
    if (!entry) return this.statBySdk(path);
    return statForEntry(entry);
  }

  async readdir(resource: ResourceUri): Promise<[string, FileType][]> {
    const path = normalizePath(resource.path);
    if (path === "/") return [["home", FileType.Directory]];
    if (path === APPKITS_WORKSPACE_PRESENTATION_ROOT) {
      return [["agent", FileType.Directory]];
    }
    if (path === APPKITS_WORKSPACE_FILE) {
      throw providerError("File is not a directory", FileSystemProviderErrorCode.FileNotADirectory);
    }
    const entries = await this.list(path);
    return entries.map((entry) => [entry.name, entry.type]);
  }

  async readFile(resource: ResourceUri): Promise<Uint8Array> {
    const path = normalizePath(resource.path);
    if (path === APPKITS_WORKSPACE_FILE) return workspaceFileBytes();
    const sdkPath = requireSdkAuthorityPath(path);
    try {
      const file = await appkits.FileSystem.read(sdkPath);
      if (typeof file.bodyBase64 === "string") return base64ToBytes(file.bodyBase64);
      return textEncoder.encode(typeof file.body === "string" ? file.body : "");
    } catch (error) {
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
    const sdkPath = requireSdkAuthorityPath(path);
    if (!opts.overwrite) {
      try {
        await this.stat(resource);
        throw providerError("File exists", FileSystemProviderErrorCode.FileExists);
      } catch (error) {
        if (!isProviderCode(error, FileSystemProviderErrorCode.FileNotFound)) throw error;
      }
    }
    await appkits.FileSystem.write({
      path: sdkPath,
      bodyBase64: bytesToBase64(content),
      contentType: contentTypeForPath(sdkPath),
    });
    this.invalidate(dirname(path));
    this.fileStatCache.set(path, fileEntry(path, content.length));
    this.fire(path, FileChangeType.UPDATED);
  }

  async mkdir(resource: ResourceUri): Promise<void> {
    const path = requireSdkAuthorityPath(normalizePath(resource.path));
    await appkits.FileSystem.mkdir(path);
    this.invalidate(dirname(path));
    this.fire(path, FileChangeType.ADDED);
  }

  async delete(resource: ResourceUri, _opts: IFileDeleteOptions): Promise<void> {
    const path = requireSdkAuthorityPath(normalizePath(resource.path));
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
    const fromPath = requireSdkAuthorityPath(normalizePath(from.path));
    const toPath = requireSdkAuthorityPath(normalizePath(to.path));
    await appkits.FileSystem.move(fromPath, toPath);
    this.invalidate(dirname(fromPath));
    this.invalidate(dirname(toPath));
    this.fileStatCache.delete(fromPath);
    this.fire(fromPath, FileChangeType.DELETED);
    this.fire(toPath, FileChangeType.ADDED);
  }

  private async list(path: string): Promise<CachedEntry[]> {
    const normalized = normalizePath(path);
    if (!isSdkAuthorityPath(normalized)) return [];
    const cached = this.directoryCache.get(normalized);
    if (cached) return cached;
    const result = await appkits.FileSystem.list(normalized);
    const entries = (Array.isArray(result.entries) ? result.entries : [])
      .map((entry) => normalizeEntry(entry))
      .filter((entry): entry is CachedEntry => Boolean(entry));
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

  private async statBySdk(path: string): Promise<IStat> {
    const sdkPath = requireSdkAuthorityPath(path);
    try {
      return await this.statFileByRead(sdkPath);
    } catch (fileError) {
      try {
        const entries = await this.list(sdkPath);
        if (entries.length > 0) return statForEntry(directoryEntry(sdkPath));
      } catch {
        // Fall through to the original file read failure.
      }
      throw fileError;
    }
  }

  private async statFileByRead(path: string): Promise<IStat> {
    try {
      const file = await appkits.FileSystem.read(path);
      const size =
        typeof file.bodyBase64 === "string"
          ? base64ToBytes(file.bodyBase64).byteLength
          : textEncoder.encode(typeof file.body === "string" ? file.body : "").byteLength;
      const entry = fileEntry(path, size);
      this.fileStatCache.set(path, entry);
      return statForEntry(entry);
    } catch (error) {
      throw providerError(errorMessage(error), FileSystemProviderErrorCode.FileNotFound);
    }
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
    JSON.stringify(
      {
        folders: [
          {
            name: basename(APPKITS_WORKSPACE_PRESENTATION_ROOT),
            path: APPKITS_WORKSPACE_PRESENTATION_ROOT,
          },
        ],
      },
      null,
      2,
    ),
  );
}

function normalizePath(path: string): string {
  const normalized = path.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  if (normalized === "/" || normalized === APPKITS_WORKSPACE_PRESENTATION_ROOT) {
    return normalized;
  }
  return normalizeAppKitsPath(path);
}

function isSdkAuthorityPath(path: string): boolean {
  return (
    path === APPKITS_WORKSPACE_ROOT ||
    path.startsWith(`${APPKITS_WORKSPACE_ROOT}/`)
  );
}

function requireSdkAuthorityPath(path: string): string {
  if (isSdkAuthorityPath(path)) return path;
  throw providerError(
    "Virtual workspace paths are not AppKits SDK authorities",
    FileSystemProviderErrorCode.NoPermissions,
  );
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
