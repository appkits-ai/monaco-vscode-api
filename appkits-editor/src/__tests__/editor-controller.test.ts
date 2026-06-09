import { describe, expect, it, vi } from "vitest";
import { EditorController } from "../editor-controller";
import type {
  SingleFileSession,
  SingleFileSessionInput,
} from "../editor-session-types";

function elements() {
  document.body.innerHTML = `
    <div id="host"></div>
    <div id="empty"></div>
    <div id="name"></div>
    <div id="path"></div>
    <div id="status"></div>
    <button id="save"></button>
  `;
  return {
    host: document.getElementById("host")!,
    emptyState: document.getElementById("empty")!,
    fileName: document.getElementById("name")!,
    filePath: document.getElementById("path")!,
    status: document.getElementById("status")!,
    saveButton: document.getElementById("save") as HTMLButtonElement,
  };
}

function fakeSession(input: SingleFileSessionInput) {
  let dirty = false;
  let value = input.body;
  let disposed = false;
  const listeners = new Set<(dirty: boolean) => void>();
  const session: SingleFileSession & {
    setValue(value: string): void;
    disposed(): boolean;
  } = {
    path: input.path,
    getValue: () => value,
    isDirty: () => dirty,
    async markSaved() {
      dirty = false;
      listeners.forEach((listener) => listener(dirty));
    },
    onDirtyChange(listener) {
      listeners.add(listener);
      listener(dirty);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
    setValue(nextValue: string) {
      value = nextValue;
      dirty = true;
      listeners.forEach((listener) => listener(dirty));
    },
    disposed: () => disposed,
  };
  return session;
}

const scopedFile = {
  version: 1,
  role: "editor",
  scope: "desktop-file",
  path: "/home/agent/workspace/app.ts",
  name: "app.ts",
  kind: "file",
  contentType: "text/typescript",
  local: true,
} as const;

describe("EditorController", () => {
  it("tracks dirty state and saves through the scoped bridge", async () => {
    const sessions: ReturnType<typeof fakeSession>[] = [];
    const bridge = {
      postWindowTitle: vi.fn(),
      readFile: vi.fn(async () => ({
        path: scopedFile.path,
        body: "let value = 1;\n",
        contentType: scopedFile.contentType,
        local: true,
      })),
      writeFile: vi.fn(async () => ({
        path: scopedFile.path,
        contentType: scopedFile.contentType,
        local: true,
      })),
    };
    const controller = new EditorController({
      bridge,
      elements: elements(),
      createSession: async (_host, input) => {
        const session = fakeSession(input);
        sessions.push(session);
        return session;
      },
    });

    await controller.open(scopedFile);
    expect((document.getElementById("save") as HTMLButtonElement).disabled).toBe(
      true,
    );
    sessions[0]!.setValue("let value = 2;\n");
    expect((document.getElementById("save") as HTMLButtonElement).disabled).toBe(
      false,
    );

    await controller.save();
    expect(bridge.writeFile).toHaveBeenCalledWith({
      path: scopedFile.path,
      body: "let value = 2;\n",
      contentType: scopedFile.contentType,
    });
    expect((document.getElementById("save") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("keeps dirty state when save fails", async () => {
    const sessions: ReturnType<typeof fakeSession>[] = [];
    const bridge = {
      postWindowTitle: vi.fn(),
      readFile: vi.fn(async () => ({
        path: scopedFile.path,
        body: "let value = 1;\n",
        contentType: scopedFile.contentType,
        local: true,
      })),
      writeFile: vi.fn(async () => {
        throw new Error("write failed");
      }),
    };
    const controller = new EditorController({
      bridge,
      elements: elements(),
      createSession: async (_host, input) => {
        const session = fakeSession(input);
        sessions.push(session);
        return session;
      },
    });

    await controller.open(scopedFile);
    sessions[0]!.setValue("let value = 3;\n");
    await controller.save();
    expect(document.getElementById("status")?.textContent).toBe("write failed");
    expect((document.getElementById("save") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("disposes the previous model session when opening another file", async () => {
    const sessions: ReturnType<typeof fakeSession>[] = [];
    const bridge = {
      postWindowTitle: vi.fn(),
      readFile: vi.fn(async () => ({
        path: scopedFile.path,
        body: "content",
        contentType: scopedFile.contentType,
        local: true,
      })),
      writeFile: vi.fn(),
    };
    const controller = new EditorController({
      bridge,
      elements: elements(),
      createSession: async (_host, input) => {
        const session = fakeSession(input);
        sessions.push(session);
        return session;
      },
    });

    await controller.open(scopedFile);
    await controller.open({ ...scopedFile, path: "/home/agent/workspace/next.ts", name: "next.ts" });
    expect(sessions[0]!.disposed()).toBe(true);
    expect(sessions[1]!.disposed()).toBe(false);
  });
});
