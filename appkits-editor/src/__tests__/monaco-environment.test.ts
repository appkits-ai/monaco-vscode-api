import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installMonacoEnvironment,
  isBundledWorkerUrl,
  monacoWorkerKind,
  monacoWorkerModuleUrl,
  monacoWorkerOptions,
} from "../monaco-environment";

const UNBUNDLED_EXTENSION_HOST_SPECIFIER =
  "../vscode/src/vs/workbench/api/worker/extensionHostWorkerMain.js";

vi.mock("monaco-editor/esm/vs/editor/editor.worker.js?worker&url", () => ({
  default: "https://vscode-editor-plugin.w3kits.com/assets/editor.worker.js",
}));
vi.mock("@codingame/monaco-vscode-api/workers/extensionHost.worker?worker&url", () => ({
  default: "https://vscode-editor-plugin.w3kits.com/assets/extensionHost.worker.js",
}));
vi.mock("@codingame/monaco-vscode-textmate-service-override/worker?worker&url", () => ({
  default: "https://vscode-editor-plugin.w3kits.com/assets/textmate.worker.js",
}));

describe("monaco-environment", () => {
  afterEach(() => {
    delete window.MonacoEnvironment;
  });

  it("rejects data: stubs that cannot resolve the extension-host specifier", () => {
    expect(isBundledWorkerUrl("data:text/javascript,import 'x'")).toBe(false);
    expect(
      isBundledWorkerUrl(`data:text/javascript,import '${UNBUNDLED_EXTENSION_HOST_SPECIFIER}'`),
    ).toBe(false);
    expect(isBundledWorkerUrl("")).toBe(false);
    expect(
      isBundledWorkerUrl(
        "https://vscode-editor-plugin.w3kits.com/assets/extensionHost.worker.js",
      ),
    ).toBe(true);
  });

  it("routes claimed worker labels and leaves the extension-host iframe unclaimed", () => {
    expect(monacoWorkerKind("extensionHostWorkerMain")).toBe("extensionHost");
    expect(monacoWorkerKind("TextMateWorker")).toBe("textmate");
    expect(monacoWorkerKind("editorWorkerService")).toBe("editor");
    expect(monacoWorkerKind("webWorkerExtensionHostIframe")).toBeNull();
    expect(monacoWorkerKind("json")).toBeNull();
    const extensionHostUrl = monacoWorkerModuleUrl("extensionHostWorkerMain");
    const editorUrl = monacoWorkerModuleUrl("editorWorkerService");
    const textmateUrl = monacoWorkerModuleUrl("TextMateWorker");
    expect(extensionHostUrl).toBeTruthy();
    expect(isBundledWorkerUrl(extensionHostUrl ?? "")).toBe(true);
    expect(extensionHostUrl).not.toMatch(/^data:/);
    expect(extensionHostUrl).not.toContain(UNBUNDLED_EXTENSION_HOST_SPECIFIER);
    expect(editorUrl).toBe("https://vscode-editor-plugin.w3kits.com/assets/editor.worker.js");
    expect(textmateUrl).toBe("https://vscode-editor-plugin.w3kits.com/assets/textmate.worker.js");
    expect(isBundledWorkerUrl(editorUrl ?? "")).toBe(true);
    expect(isBundledWorkerUrl(textmateUrl ?? "")).toBe(true);
    expect(monacoWorkerModuleUrl("webWorkerExtensionHostIframe")).toBeNull();
    expect(monacoWorkerOptions("extensionHostWorkerMain")).toEqual({ type: "module" });
    expect(monacoWorkerOptions("editorWorkerService")).toEqual({ type: "module" });
    expect(monacoWorkerOptions("TextMateWorker")).toEqual({ type: "module" });
    expect(monacoWorkerOptions("webWorkerExtensionHostIframe")).toBeUndefined();
  });

  it("installs getWorkerUrl and module options for the extension host", () => {
    installMonacoEnvironment();
    expect(typeof window.MonacoEnvironment?.getWorker).toBe("function");
    expect(typeof window.MonacoEnvironment?.getWorkerUrl).toBe("function");
    expect(typeof window.MonacoEnvironment?.getWorkerOptions).toBe("function");
    const url = window.MonacoEnvironment?.getWorkerUrl?.(
      "workerMain.js",
      "extensionHostWorkerMain",
    );
    const options = window.MonacoEnvironment?.getWorkerOptions?.(
      "workerMain.js",
      "extensionHostWorkerMain",
    );
    expect(url).toBeTruthy();
    expect(isBundledWorkerUrl(url ?? "")).toBe(true);
    expect(url).not.toMatch(/^data:/);
    expect(url).not.toContain(UNBUNDLED_EXTENSION_HOST_SPECIFIER);
    expect(options?.type).toBe("module");
    expect(
      window.MonacoEnvironment?.getWorkerUrl?.(
        "workerMain.js",
        "webWorkerExtensionHostIframe",
      ),
    ).toBeUndefined();
    expect(
      window.MonacoEnvironment?.getWorkerOptions?.(
        "workerMain.js",
        "webWorkerExtensionHostIframe",
      ),
    ).toBeUndefined();
    expect(
      window.MonacoEnvironment?.getWorker?.(
        "workerMain.js",
        "webWorkerExtensionHostIframe",
      ),
    ).toBeUndefined();
  });

  it("does not let the extension-host iframe importScripts an ESM worker URL", () => {
    installMonacoEnvironment();
    const url = window.MonacoEnvironment?.getWorkerUrl?.(
      "workerMain.js",
      "extensionHostWorkerMain",
    );
    const options = window.MonacoEnvironment?.getWorkerOptions?.(
      "workerMain.js",
      "extensionHostWorkerMain",
    );
    expect(url).toBeTruthy();
    expect(options?.type === "module" ? "await import" : "importScripts").toBe(
      "await import",
    );
  });
});
