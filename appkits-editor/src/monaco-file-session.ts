import * as monaco from "monaco-editor";
import * as vscode from "vscode";
import type { AppKitsVfsClient } from "./appkits-vfs-provider";
import { registerAppKitsVfsOverlay } from "./appkits-vfs-provider";
import { initializeVscodeEditorServices } from "./vscode-services";
import type {
  SingleFileSession,
  SingleFileSessionInput,
} from "./editor-session-types";

interface DisposableLike {
  dispose(): void;
}

export async function createMonacoFileSession(
  host: HTMLElement,
  input: SingleFileSessionInput,
  vfsClient?: AppKitsVfsClient,
): Promise<SingleFileSession> {
  await initializeVscodeEditorServices();
  host.replaceChildren();

  const uri = vscode.Uri.file(normalizeModelPath(input.path, input.name));
  const overlay = vfsClient ? await registerAppKitsVfsOverlay(vfsClient) : undefined;
  const modelReference = await monaco.editor.createModelReference(uri);
  const model = modelReference.object.textEditorModel;
  if (!model) throw new Error("model_not_available");
  if (!vfsClient && model.getValue() !== input.body) {
    model.setValue(input.body);
  }
  const editor = monaco.editor.create(host, {
    model,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
  });
  const disposables: DisposableLike[] = overlay ? [overlay] : [];

  const dirtyListeners = new Set<(dirty: boolean) => void>();
  const notifyDirty = () => {
    const dirty = modelReference.object.isDirty();
    for (const listener of dirtyListeners) listener(dirty);
  };
  disposables.push(modelReference.object.onDidChangeDirty(notifyDirty));
  disposables.push(editor.onDidChangeModelContent(notifyDirty));

  return {
    path: input.path,
    getValue() {
      return editor.getValue();
    },
    isDirty() {
      return modelReference.object.isDirty();
    },
    async markSaved() {
      await modelReference.object.save();
      notifyDirty();
    },
    onDirtyChange(listener) {
      dirtyListeners.add(listener);
      listener(modelReference.object.isDirty());
      return () => dirtyListeners.delete(listener);
    },
    dispose() {
      for (const disposable of disposables.splice(0)) disposable.dispose();
      editor.dispose();
      modelReference.dispose();
      host.replaceChildren();
      dirtyListeners.clear();
    },
  };
}

function normalizeModelPath(path: string, name: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith("/")) return trimmed;
  const fallbackName = name.trim() || "untitled.txt";
  return `/appkits/${fallbackName.replace(/^\/+/, "")}`;
}
