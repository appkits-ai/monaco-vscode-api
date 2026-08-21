import { afterEach, describe, expect, it } from "vitest";
import {
  installMonacoEnvironment,
  monacoWorkerKind,
  monacoWorkerModuleUrl,
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
  });

  it("installs getWorkerUrl for the extension host and falls through for the iframe", () => {
    installMonacoEnvironment();
    expect(typeof window.MonacoEnvironment?.getWorker).toBe("function");
    expect(typeof window.MonacoEnvironment?.getWorkerUrl).toBe("function");
    const url = window.MonacoEnvironment?.getWorkerUrl?.(
      "workerMain.js",
      "extensionHostWorkerMain",
    );
    expect(url).toContain("extensionHost.worker");
    expect(
      window.MonacoEnvironment?.getWorkerUrl?.(
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
});
