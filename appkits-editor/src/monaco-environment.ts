/**
 * 在 vscode 导入前安装 Monaco worker，含 extensionHostWorkerMain 的 URL。
 * Installs Monaco workers before vscode imports, including extensionHostWorkerMain URLs.
 *
 * @owner appkits-editor
 * @module vscode-editor
 */

export type MonacoWorkerKind = "textmate" | "extensionHost" | "editor";

/**
 * 把 Monaco worker 标签映射到打包入口。
 * Maps a Monaco worker label to the bundled entry kind.
 */
export function monacoWorkerKind(label: string): MonacoWorkerKind {
  if (label === "TextMateWorker") return "textmate";
  if (label === "extensionHostWorkerMain") return "extensionHost";
  return "editor";
}

/**
 * 解析某个 worker 标签的模块 URL，供 getWorker 与 getWorkerUrl 共用。
 * Resolves the module URL for a worker label for both getWorker and getWorkerUrl.
 */
export function monacoWorkerModuleUrl(label: string): URL {
  const kind = monacoWorkerKind(label);
  if (kind === "textmate") {
    return new URL(
      "@codingame/monaco-vscode-textmate-service-override/worker",
      import.meta.url,
    );
  }
  if (kind === "extensionHost") {
    return new URL(
      "@codingame/monaco-vscode-api/workers/extensionHost.worker",
      import.meta.url,
    );
  }
  return new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url);
}

/**
 * 写入 window.MonacoEnvironment，让主线程和嵌套 factory 都能找到 worker。
 * Writes window.MonacoEnvironment so the main thread and nested factories can find workers.
 */
export function installMonacoEnvironment(): void {
  window.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      return new Worker(monacoWorkerModuleUrl(label), { type: "module" });
    },
    getWorkerUrl(_moduleId: string, label: string) {
      return monacoWorkerModuleUrl(label).toString();
    },
  };
}

installMonacoEnvironment();
