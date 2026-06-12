import type {
  IFileChange,
  IFileDeleteOptions,
  IFileOverwriteOptions,
  IFileSystemProviderWithFileReadWriteCapability,
  IFileWriteOptions,
  IStat,
  IWatchOptions,
} from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";
const FileType = { File: 1, Directory: 2 } as const;
const FileChangeType = { UPDATED: 0, ADDED: 1, DELETED: 2 } as const;
const FileSystemProviderCapabilities = { FileReadWrite: 2 } as const;

type EventLike<T> = ((listener: (event: T) => unknown) => IDisposable) & { None?: unknown };
class SimpleEmitter<T> {
  private readonly listeners = new Set<(event: T) => unknown>();
  readonly event: EventLike<T> = ((listener: (event: T) => unknown) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }) as EventLike<T>;
  fire(event: T): void {
    for (const listener of this.listeners) listener(event);
  }
  dispose(): void {
    this.listeners.clear();
  }
}
const NoopEvent = (() => ({ dispose() {} })) as EventLike<void>;
import type { IDisposable } from "@codingame/monaco-vscode-api/vscode/vs/base/common/lifecycle";
import type { URI } from "@codingame/monaco-vscode-api/vscode/vs/base/common/uri";
import type { AppKitsBridge } from "./appkits-bridge";
import { normalizeWorkspacePath, parentPath, WORKSPACE_ROOT } from "./workspace-model";

interface AppKitsVfsEntry {
  path: string;
  name?: string;
  kind: "file" | "directory";
  contentType?: string;
  size?: number;
  updatedAt?: string;
}

export type AppKitsVfsClient = Pick<
  AppKitsBridge,
  "listFiles" | "readFileBytes" | "writeFileBytes" | "mkdir" | "deletePath" | "renamePath"
>;

export class AppKitsVfsProvider implements IFileSystemProviderWithFileReadWriteCapability {
  readonly capabilities = FileSystemProviderCapabilities.FileReadWrite;
  readonly onDidChangeCapabilities = NoopEvent;
  private readonly changes = new SimpleEmitter<readonly IFileChange[]>();
  readonly onDidChangeFile = this.changes.event;

  constructor(private readonly client: AppKitsVfsClient) {}

  async stat(resource: URI): Promise<IStat> {
    const path = uriPath(resource);
    if (path === WORKSPACE_ROOT) return directoryStat();
    const entry = await this.findEntry(path);
    if (!entry) throw new Error(`File not found: ${path}`);
    return entry.kind === "directory" ? directoryStat(entry.updatedAt) : fileStat(entry);
  }

  async readdir(resource: URI): Promise<[string, typeof FileType.File | typeof FileType.Directory][]> {
    const directory = uriPath(resource);
    const entries = await this.client.listFiles(WORKSPACE_ROOT);
    return entries
      .filter((entry) => parentPath(entry.path) === directory)
      .sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
        return (left.name || left.path).localeCompare(right.name || right.path);
      })
      .map((entry) => [entry.name || entry.path.split("/").pop() || entry.path, entry.kind === "directory" ? FileType.Directory : FileType.File]);
  }

  async readFile(resource: URI): Promise<Uint8Array> {
    return this.client.readFileBytes(uriPath(resource));
  }

  async writeFile(resource: URI, content: Uint8Array, _opts: IFileWriteOptions): Promise<void> {
    const path = uriPath(resource);
    await this.client.writeFileBytes(path, content, contentTypeForPath(path));
    this.fireChanged(path, FileChangeType.UPDATED);
  }

  async mkdir(resource: URI): Promise<void> {
    const path = uriPath(resource);
    await this.client.mkdir(path);
    this.fireChanged(path, FileChangeType.ADDED);
  }

  async delete(resource: URI, _opts: IFileDeleteOptions): Promise<void> {
    const path = uriPath(resource);
    await this.client.deletePath(path);
    this.fireChanged(path, FileChangeType.DELETED);
  }

  async rename(from: URI, to: URI, _opts: IFileOverwriteOptions): Promise<void> {
    const fromPath = uriPath(from);
    const toPath = uriPath(to);
    await this.client.renamePath(fromPath, toPath);
    this.changes.fire([
      { resource: from, type: FileChangeType.DELETED },
      { resource: to, type: FileChangeType.ADDED },
    ]);
  }

  watch(_resource: URI, _opts: IWatchOptions): IDisposable {
    return { dispose() {} };
  }

  dispose(): void {
    this.changes.dispose();
  }

  private async findEntry(path: string): Promise<AppKitsVfsEntry | null> {
    const entries = await this.client.listFiles(WORKSPACE_ROOT);
    return entries.find((entry) => entry.path === path) || null;
  }

  private fireChanged(path: string, type: typeof FileChangeType.UPDATED | typeof FileChangeType.ADDED | typeof FileChangeType.DELETED): void {
    this.changes.fire([{ resource: { scheme: "file", path } as URI, type }]);
  }
}

export async function registerAppKitsVfsOverlay(client: AppKitsVfsClient): Promise<IDisposable> {
  const { registerFileSystemOverlay } = await import(
    "@codingame/monaco-vscode-files-service-override"
  );
  return registerFileSystemOverlay(10, new AppKitsVfsProvider(client));
}

function uriPath(resource: URI): string {
  return normalizeWorkspacePath(resource.path);
}

function directoryStat(updatedAt?: string): IStat {
  const mtime = updatedAt ? Date.parse(updatedAt) || Date.now() : Date.now();
  return { type: FileType.Directory, ctime: mtime, mtime, size: 0 };
}

function fileStat(entry: AppKitsVfsEntry): IStat {
  const mtime = entry.updatedAt ? Date.parse(entry.updatedAt) || Date.now() : Date.now();
  return { type: FileType.File, ctime: mtime, mtime, size: entry.size || 0 };
}

function contentTypeForPath(path: string): string {
  if (/\.md$/i.test(path)) return "text/markdown;charset=UTF-8";
  if (/\.html?$/i.test(path)) return "text/html;charset=UTF-8";
  if (/\.jsonc?$/i.test(path)) return "application/json;charset=UTF-8";
  if (/\.(css|js|jsx|ts|tsx|txt|log|yml|yaml|toml|xml|sh|py|go|rs)$/i.test(path)) {
    return "text/plain;charset=UTF-8";
  }
  return "application/octet-stream";
}
