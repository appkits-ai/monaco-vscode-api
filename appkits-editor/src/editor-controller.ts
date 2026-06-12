import type { AppKitsBridge } from "./appkits-bridge";
import { openFileFromLaunchParams } from "./launch-params";
import type { AppKitsOpenFile, AppKitsReadFileResult } from "./types";
import type {
  SingleFileSession,
  SingleFileSessionInput,
} from "./editor-session-types";
import {
  buildWorkspaceTree,
  filenameFromPath,
  normalizeWorkspacePath,
  openFileFromPath,
  WORKSPACE_ROOT,
  type WorkspaceEntry,
  type WorkspaceTreeNode,
} from "./workspace-model";

export interface EditorControllerElements {
  host: HTMLElement;
  tree: HTMLElement;
  fileName: HTMLElement;
  filePath: HTMLElement;
  workspacePath: HTMLElement;
  status: HTMLElement;
  saveButton: HTMLButtonElement;
  refreshButton: HTMLButtonElement;
}

export interface EditorControllerOptions {
  bridge: Pick<
    AppKitsBridge,
    | "postWindowTitle"
    | "readFile"
    | "writeFile"
    | "listFiles"
    | "launchParams"
    | "onLaunchParams"
    | "readFileBytes"
    | "writeFileBytes"
    | "mkdir"
    | "deletePath"
    | "renamePath"
  >;
  elements: EditorControllerElements;
  createSession?: (
    host: HTMLElement,
    input: SingleFileSessionInput,
    bridge: EditorControllerOptions["bridge"],
  ) => Promise<SingleFileSession>;
}

export class EditorController {
  private readonly bridge: EditorControllerOptions["bridge"];
  private readonly elements: EditorControllerElements;
  private readonly createSession: NonNullable<EditorControllerOptions["createSession"]>;
  private openFile: AppKitsOpenFile | null = null;
  private loadedFile: AppKitsReadFileResult | null = null;
  private entries: WorkspaceEntry[] = [];
  private session: SingleFileSession | null = null;
  private unsubscribeDirty: (() => void) | null = null;
  private unsubscribeLaunch: (() => void) | null = null;
  private saving = false;
  private dirty = false;

  constructor(options: EditorControllerOptions) {
    this.bridge = options.bridge;
    this.elements = options.elements;
    this.createSession = options.createSession ?? createDefaultSession;
    this.elements.saveButton.addEventListener("click", () => {
      void this.save();
    });
    this.elements.refreshButton.addEventListener("click", () => {
      void this.loadWorkspace();
    });
    this.unsubscribeLaunch = this.bridge.onLaunchParams((params) => {
      const openFile = openFileFromLaunchParams(params);
      if (openFile) void this.open(openFile);
    });
    this.render();
  }

  async initialize(): Promise<void> {
    this.setStatus("Loading workspace");
    const [params] = await Promise.all([this.bridge.launchParams(), this.loadWorkspace()]);
    const openFile = openFileFromLaunchParams(params);
    if (openFile) await this.open(openFile);
    else this.bridge.postWindowTitle("VS Code Editor - /home/agent");
  }

  async loadWorkspace(): Promise<void> {
    try {
      const entries = await this.bridge.listFiles(WORKSPACE_ROOT);
      this.entries = entries.map((entry) => ({
        path: normalizeWorkspacePath(entry.path),
        name: entry.name || filenameFromPath(entry.path),
        kind: entry.kind,
        contentType: entry.contentType,
        size: entry.size,
        updatedAt: entry.updatedAt,
      }));
      this.renderTree();
      this.setStatus(this.openFile ? "Ready" : "Workspace ready");
    } catch (error) {
      this.setStatus(errorMessage(error));
    }
  }

  async open(scopedFile: AppKitsOpenFile): Promise<void> {
    this.setStatus("Opening");
    this.disposeSession();
    this.openFile = scopedFile;
    this.loadedFile = null;
    this.dirty = false;
    this.render();

    try {
      const loadedFile = await this.bridge.readFile(scopedFile.path);
      this.loadedFile = loadedFile;
      this.session = await this.createSession(
        this.elements.host,
        {
          path: scopedFile.path,
          name: scopedFile.name,
          body: loadedFile.body,
        },
        this.bridge,
      );
      this.unsubscribeDirty = this.session.onDirtyChange((dirty) => {
        this.dirty = dirty;
        this.render();
      });
      this.setStatus("Ready");
      this.bridge.postWindowTitle(scopedFile.name);
    } catch (error) {
      this.setStatus(errorMessage(error));
    } finally {
      this.render();
      this.renderTree();
    }
  }

  async openPath(path: string): Promise<void> {
    await this.open(openFileFromPath(path, this.entries));
  }

  async save(): Promise<void> {
    if (!this.openFile || !this.loadedFile || !this.session || this.saving) return;
    if (!["editor", "exporter"].includes(this.openFile.role)) return;

    this.saving = true;
    this.render();
    this.setStatus("Saving");
    try {
      await this.bridge.writeFile({
        path: this.openFile.path,
        body: this.session.getValue(),
        contentType: this.loadedFile.contentType || this.openFile.contentType,
      });
      await this.session.markSaved();
      this.dirty = this.session.isDirty();
      this.setStatus("Saved");
      await this.loadWorkspace();
    } catch (error) {
      this.setStatus(errorMessage(error));
    } finally {
      this.saving = false;
      this.render();
    }
  }

  dispose(): void {
    this.unsubscribeLaunch?.();
    this.unsubscribeLaunch = null;
    this.disposeSession();
  }

  private disposeSession(): void {
    this.unsubscribeDirty?.();
    this.unsubscribeDirty = null;
    this.session?.dispose();
    this.session = null;
  }

  private setStatus(value: string): void {
    this.elements.status.textContent = value;
  }

  private render(): void {
    const canEdit = this.openFile
      ? ["editor", "exporter"].includes(this.openFile.role)
      : false;
    this.elements.fileName.textContent = this.openFile?.name ?? "/home/agent";
    this.elements.filePath.textContent =
      this.openFile?.path ?? "Browse workspace files from the left tree.";
    this.elements.workspacePath.textContent = WORKSPACE_ROOT;
    this.elements.saveButton.disabled =
      !canEdit || !this.session || !this.dirty || this.saving;
    this.elements.saveButton.textContent = this.saving ? "Saving" : "Save";
  }

  private renderTree(): void {
    const tree = buildWorkspaceTree(this.entries);
    this.elements.tree.replaceChildren(renderNode(tree, this.openFile?.path, (path) => {
      void this.openPath(path);
    }));
  }
}

function renderNode(
  node: WorkspaceTreeNode,
  activePath: string | undefined,
  openPath: (path: string) => void,
): HTMLElement {
  const container = document.createElement("div");
  container.className = "tree-node";
  const header = document.createElement("div");
  header.className = "tree-folder";
  header.textContent = node.path === WORKSPACE_ROOT ? "/home/agent" : node.name;
  container.append(header);

  const children = document.createElement("div");
  children.className = "tree-children";
  for (const child of node.children) children.append(renderNode(child, activePath, openPath));
  for (const file of node.files) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tree-file";
    button.dataset.active = file.path === activePath ? "true" : "false";
    button.textContent = file.name;
    button.title = file.path;
    button.addEventListener("click", () => openPath(file.path));
    children.append(button);
  }
  container.append(children);
  return container;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Editor request failed.";
}

async function createDefaultSession(
  host: HTMLElement,
  input: SingleFileSessionInput,
  bridge: EditorControllerOptions["bridge"],
): Promise<SingleFileSession> {
  const { createMonacoFileSession } = await import("./monaco-file-session");
  return createMonacoFileSession(host, input, bridge);
}
