import { afterEach, describe, expect, it } from "vitest";
import {
  installMonacoEnvironment,
  monacoWorkerKind,
  monacoWorkerModuleUrl,
  monacoWorkerOptions,
} from "../monaco-environment";

describe("monaco-environment", () => {
  afterEach(() => {
    delete window.MonacoEnvironment;
  });

  it("routes claimed worker labels and leaves the extension-host iframe unclaimed", () => {
    expect(monacoWorkerKind("extensionHostWorkerMain")).toBe("extensionHost");
    expect(monacoWorkerKind("TextMateWorker")).toBe("textmate");
    expect(monacoWorkerKind("editorWorkerService")).toBe("editor");
    expect(monacoWorkerKind("webWorkerExtensionHostIframe")).toBeNull();
    expect(monacoWorkerKind("json")).toBeNull();
    expect(monacoWorkerModuleUrl("extensionHostWorkerMain")?.href).toContain(
      "extensionHost.worker",
    );
    expect(monacoWorkerModuleUrl("webWorkerExtensionHostIframe")).toBeNull();
    expect(monacoWorkerOptions("extensionHostWorkerMain")).toEqual({ type: "module" });
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
    expect(url).toContain("extensionHost.worker");
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
