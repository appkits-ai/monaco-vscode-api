import type { AppKitsBridge } from "./appkits-bridge";
import type { AppKitsOpenFile, AppKitsWorkspaceEntry } from "./types";

export interface WorkspaceBrowserElements {
  filesButton: HTMLButtonElement;
  drawer: HTMLElement;
  backdrop: HTMLElement;
  tree: HTMLElement;
}

export interface WorkspaceBrowserOptions {
  bridge: Pick<AppKitsBridge, "listWorkspaceFiles">;
  elements: WorkspaceBrowserElements;
  onOpenFile: (file: AppKitsOpenFile) => void;
}

const HOME_ROOT = "/home/agent";

export class WorkspaceBrowser {
  private readonly bridge: WorkspaceBrowserOptions["bridge"];
  private readonly elements: WorkspaceBrowserElements;
  private readonly onOpenFile: WorkspaceBrowserOptions["onOpenFile"];
  private entries: AppKitsWorkspaceEntry[] = [];
  private selectedPath: string | null = null;
  private loading = false;

  constructor(options: WorkspaceBrowserOptions) {
    this.bridge = options.bridge;
    this.elements = options.elements;
    this.onOpenFile = options.onOpenFile;
    this.elements.filesButton.addEventListener("click", () => void this.open());
    this.elements.backdrop.addEventListener("click", () => this.close());
    this.render();
  }

  async open(): Promise<void> {
    this.elements.drawer.hidden = false;
    this.elements.backdrop.hidden = false;
    await this.refresh();
  }

  close(): void {
    this.elements.drawer.hidden = true;
    this.elements.backdrop.hidden = true;
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.render();
    try {
      this.entries = sortEntries((await this.bridge.listWorkspaceFiles()).entries);
    } finally {
      this.loading = false;
      this.render();
    }
  }

  select(path: string | null): void {
    this.selectedPath = path;
    this.render();
  }

  private render(): void {
    this.elements.tree.replaceChildren();
    if (this.loading) {
      const item = document.createElement("div");
      item.className = "tree-empty";
      item.textContent = "Loading";
      this.elements.tree.append(item);
      return;
    }
    const visibleEntries = this.entries.filter((entry) => isDirectHomeChild(entry.path));
    if (visibleEntries.length === 0) {
      const item = document.createElement("div");
      item.className = "tree-empty";
      item.textContent = "No files";
      this.elements.tree.append(item);
      return;
    }
    for (const entry of visibleEntries) this.elements.tree.append(this.renderEntry(entry));
  }

  private renderEntry(entry: AppKitsWorkspaceEntry): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tree-item";
    button.dataset.kind = entry.kind;
    button.dataset.selected = entry.path === this.selectedPath ? "true" : "false";
    button.textContent = entry.name || filenameFromPath(entry.path);
    button.addEventListener("click", () => {
      if (entry.kind !== "file") return;
      this.selectedPath = entry.path;
      this.onOpenFile(workspaceEntryToOpenFile(entry));
      this.close();
      this.render();
    });
    return button;
  }
}

export function workspaceEntryToOpenFile(entry: AppKitsWorkspaceEntry): AppKitsOpenFile {
  return {
    version: 1,
    role: "editor",
    scope: "desktop-file",
    path: entry.path,
    name: entry.name || filenameFromPath(entry.path),
    kind: "file",
    contentType: entry.contentType || "application/octet-stream",
    local: entry.local === true,
  };
}

function sortEntries(entries: AppKitsWorkspaceEntry[]): AppKitsWorkspaceEntry[] {
  return entries
    .filter((entry) => entry.path.startsWith(HOME_ROOT))
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
      return left.path.localeCompare(right.path);
    });
}

function isDirectHomeChild(path: string): boolean {
  const remainder = path.slice(HOME_ROOT.length).replace(/^\//, "");
  return remainder.length > 0 && !remainder.includes("/");
}

function filenameFromPath(path: string): string {
  return path.split("/").filter(Boolean).at(-1) || path;
}
