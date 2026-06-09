import type { W3KitsBridge } from "./w3kits-bridge";
import type { W3KitsOpenFile, W3KitsReadFileResult } from "./types";
import type {
  SingleFileSession,
  SingleFileSessionInput,
} from "./editor-session-types";

export interface EditorControllerElements {
  host: HTMLElement;
  emptyState: HTMLElement;
  fileName: HTMLElement;
  filePath: HTMLElement;
  status: HTMLElement;
  saveButton: HTMLButtonElement;
}

export interface EditorControllerOptions {
  bridge: Pick<W3KitsBridge, "postWindowTitle" | "readFile" | "writeFile">;
  elements: EditorControllerElements;
  createSession?: (
    host: HTMLElement,
    input: SingleFileSessionInput,
  ) => Promise<SingleFileSession>;
}

export class EditorController {
  private readonly bridge: EditorControllerOptions["bridge"];
  private readonly elements: EditorControllerElements;
  private readonly createSession: NonNullable<EditorControllerOptions["createSession"]>;
  private openFile: W3KitsOpenFile | null = null;
  private loadedFile: W3KitsReadFileResult | null = null;
  private session: SingleFileSession | null = null;
  private unsubscribeDirty: (() => void) | null = null;
  private saving = false;
  private dirty = false;

  constructor(options: EditorControllerOptions) {
    this.bridge = options.bridge;
    this.elements = options.elements;
    this.createSession = options.createSession ?? createDefaultSession;
    this.elements.saveButton.addEventListener("click", () => {
      void this.save();
    });
    this.render();
  }

  async open(scopedFile: W3KitsOpenFile): Promise<void> {
    this.setStatus("Opening");
    this.disposeSession();
    this.openFile = scopedFile;
    this.loadedFile = null;
    this.dirty = false;
    this.render();

    try {
      const loadedFile = await this.bridge.readFile(scopedFile.path);
      this.loadedFile = loadedFile;
      this.session = await this.createSession(this.elements.host, {
        path: scopedFile.path,
        name: scopedFile.name,
        body: loadedFile.body,
      });
      this.unsubscribeDirty = this.session.onDirtyChange((dirty) => {
        this.dirty = dirty;
        this.render();
      });
      this.setStatus("Ready");
      this.bridge.postWindowTitle(scopedFile.name);
      this.elements.emptyState.hidden = true;
    } catch (error) {
      this.setStatus(errorMessage(error));
      this.elements.emptyState.hidden = false;
    } finally {
      this.render();
    }
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
    } catch (error) {
      this.setStatus(errorMessage(error));
    } finally {
      this.saving = false;
      this.render();
    }
  }

  dispose(): void {
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
    this.elements.fileName.textContent = this.openFile?.name ?? "Waiting for file";
    this.elements.filePath.textContent =
      this.openFile?.path ?? "Open a file from W3Kits Explorer.";
    this.elements.saveButton.disabled =
      !canEdit || !this.session || !this.dirty || this.saving;
    this.elements.saveButton.textContent = this.saving ? "Saving" : "Save";
    this.elements.emptyState.hidden = Boolean(this.session);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Editor request failed.";
}

async function createDefaultSession(
  host: HTMLElement,
  input: SingleFileSessionInput,
): Promise<SingleFileSession> {
  const { createMonacoFileSession } = await import("./monaco-file-session");
  return createMonacoFileSession(host, input);
}
