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

  it("routes extensionHostWorkerMain to the extension host worker", () => {
    expect(monacoWorkerKind("extensionHostWorkerMain")).toBe("extensionHost");
    expect(monacoWorkerKind("TextMateWorker")).toBe("textmate");
    expect(monacoWorkerKind("json")).toBe("editor");
    expect(monacoWorkerModuleUrl("extensionHostWorkerMain").href).toContain(
      "extensionHost.worker",
    );
  });

  it("installs getWorkerUrl so nested factories can resolve extensionHostWorkerMain", () => {
    installMonacoEnvironment();
    expect(typeof window.MonacoEnvironment?.getWorker).toBe("function");
    expect(typeof window.MonacoEnvironment?.getWorkerUrl).toBe("function");
    const url = window.MonacoEnvironment?.getWorkerUrl?.(
      "workerMain.js",
      "extensionHostWorkerMain",
    );
    expect(url).toContain("extensionHost.worker");
  });
});
