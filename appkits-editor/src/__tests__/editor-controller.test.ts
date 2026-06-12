import { describe, expect, it, vi } from "vitest";
import { EditorController } from "../editor-controller";
import type {
  SingleFileSession,
  SingleFileSessionInput,
} from "../editor-session-types";

function elements() {
  document.body.innerHTML = `
    <div id="host"></div>
    <div id="tree"></div>
    <div id="name"></div>
    <div id="path"></div>
    <div id="workspace"></div>
    <div id="status"></div>
    <button id="refresh"></button>
    <button id="save"></button>
  `;
  return {
    host: document.getElementById("host")!,
    tree: document.getElementById("tree")!,
    fileName: document.getElementById("name")!,
    filePath: document.getElementById("path")!,
    workspacePath: document.getElementById("workspace")!,
    status: document.getElementById("status")!,
    saveButton: document.getElementById("save") as HTMLButtonElement,
    refreshButton: document.getElementById("refresh") as HTMLButtonElement,
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
  it("loads /home/agent on direct launch without waiting state text", async () => {
    const bridge = {
      postWindowTitle: vi.fn(),
      listFiles: vi.fn(async () => [
        { path: "/home/agent/readme.md", name: "readme.md", kind: "file" as const },
      ]),
      launchParams: vi.fn(async () => ({})),
      onLaunchParams: vi.fn(() => () => {}),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readFileBytes: vi.fn(),
      writeFileBytes: vi.fn(),
      mkdir: vi.fn(),
      deletePath: vi.fn(),
      renamePath: vi.fn(),
    };
    const controller = new EditorController({
      bridge,
      elements: elements(),
      createSession: async (_host, input) => fakeSession(input),
    });

    await controller.initialize();
    expect(bridge.listFiles).toHaveBeenCalledWith("/home/agent");
    expect(document.getElementById("name")?.textContent).toBe("/home/agent");
    expect(document.body.textContent).not.toContain("Waiting for file");
    expect(document.getElementById("tree")?.textContent).toContain("readme.md");
  });

  it("opens appkitsOpenFile after workspace launch params load", async () => {
    const sessions: ReturnType<typeof fakeSession>[] = [];
    const bridge = {
      postWindowTitle: vi.fn(),
      listFiles: vi.fn(async () => [
        { path: scopedFile.path, name: scopedFile.name, kind: "file" as const, contentType: scopedFile.contentType },
      ]),
      launchParams: vi.fn(async () => ({ appkitsOpenFile: scopedFile })),
      onLaunchParams: vi.fn(() => () => {}),
      readFile: vi.fn(async () => ({
        path: scopedFile.path,
        body: "let value = 1;\n",
        contentType: scopedFile.contentType,
        local: true,
      })),
      writeFile: vi.fn(),
      readFileBytes: vi.fn(),
      writeFileBytes: vi.fn(),
      mkdir: vi.fn(),
      deletePath: vi.fn(),
      renamePath: vi.fn(),
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

    await controller.initialize();
    expect(bridge.readFile).toHaveBeenCalledWith(scopedFile.path);
    expect(document.getElementById("name")?.textContent).toBe("app.ts");
    expect(sessions).toHaveLength(1);
  });

  it("tracks dirty state and saves through the scoped bridge", async () => {
    const sessions: ReturnType<typeof fakeSession>[] = [];
    const bridge = {
      postWindowTitle: vi.fn(),
      listFiles: vi.fn(async () => [
        { path: "/home/agent/workspace", name: "workspace", kind: "directory" as const },
        { path: scopedFile.path, name: scopedFile.name, kind: "file" as const, contentType: scopedFile.contentType },
      ]),
      launchParams: vi.fn(async () => ({})),
      onLaunchParams: vi.fn(() => () => {}),
      readFileBytes: vi.fn(),
      writeFileBytes: vi.fn(),
      mkdir: vi.fn(),
      deletePath: vi.fn(),
      renamePath: vi.fn(),
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
      listFiles: vi.fn(async () => [
        { path: "/home/agent/workspace", name: "workspace", kind: "directory" as const },
        { path: scopedFile.path, name: scopedFile.name, kind: "file" as const, contentType: scopedFile.contentType },
      ]),
      launchParams: vi.fn(async () => ({})),
      onLaunchParams: vi.fn(() => () => {}),
      readFileBytes: vi.fn(),
      writeFileBytes: vi.fn(),
      mkdir: vi.fn(),
      deletePath: vi.fn(),
      renamePath: vi.fn(),
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
      listFiles: vi.fn(async () => [
        { path: "/home/agent/workspace", name: "workspace", kind: "directory" as const },
        { path: scopedFile.path, name: scopedFile.name, kind: "file" as const, contentType: scopedFile.contentType },
      ]),
      launchParams: vi.fn(async () => ({})),
      onLaunchParams: vi.fn(() => () => {}),
      readFileBytes: vi.fn(),
      writeFileBytes: vi.fn(),
      mkdir: vi.fn(),
      deletePath: vi.fn(),
      renamePath: vi.fn(),
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
