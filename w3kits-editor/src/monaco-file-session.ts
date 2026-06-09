import * as monaco from "monaco-editor";
import * as vscode from "vscode";
import {
  RegisteredFileSystemProvider,
  RegisteredMemoryFile,
  registerFileSystemOverlay,
} from "@codingame/monaco-vscode-files-service-override";
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
): Promise<SingleFileSession> {
  await initializeVscodeEditorServices();
  host.replaceChildren();

  const uri = vscode.Uri.file(normalizeModelPath(input.path, input.name));
  const provider = new RegisteredFileSystemProvider(false);
  provider.registerFile(new RegisteredMemoryFile(uri, input.body));
  const overlay = registerFileSystemOverlay(1, provider);
  const modelReference = await monaco.editor.createModelReference(uri);
  const editor = monaco.editor.create(host, {
    model: modelReference.object.textEditorModel,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
  });
  const disposables: DisposableLike[] = [overlay];

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
  return `/w3kits/${fallbackName.replace(/^\/+/, "")}`;
}
