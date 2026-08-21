/**
 * 在 vscode 导入前安装 Monaco worker，只认领已打包的标签，其余交给官方 bundler。
 * Installs Monaco workers before vscode imports and claims only bundled labels
 * so official bundler entries such as the extension-host iframe stay intact.
 *
 * @owner appkits-editor
 * @module vscode-editor
 */

export type MonacoWorkerKind = "textmate" | "extensionHost" | "editor";

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker?(moduleId: string, label: string): Worker | undefined;
      getWorkerUrl?(moduleId: string, label: string): string | undefined;
      getWorkerOptions?(moduleId: string, label: string): WorkerOptions | undefined;
    };
  }
}

/**
 * 把已认领的 Monaco worker 标签映射到打包入口；未认领的标签返回空。
 * Maps a claimed Monaco worker label to the bundled entry kind; unclaimed
 * labels return null so vscode can use esmModuleLocationBundler.
 */
export function monacoWorkerKind(label: string): MonacoWorkerKind | null {
  if (label === "TextMateWorker") return "textmate";
  if (label === "extensionHostWorkerMain") return "extensionHost";
  if (label === "editorWorkerService") return "editor";
  return null;
}

/**
 * 解析已认领 worker 标签的模块 URL；未认领时不返回 URL。
 * Resolves the module URL for a claimed worker label and returns null when
 * the official bundler must keep the descriptor.
 */
export function monacoWorkerModuleUrl(label: string): URL | null {
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
  if (kind === "editor") {
    return new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url);
  }
  return null;
}

/**
 * 写入 window.MonacoEnvironment；getWorker / getWorkerUrl 对未认领标签返回 undefined。
 * Writes window.MonacoEnvironment. getWorker and getWorkerUrl return undefined
 * for unclaimed labels so nested factories keep the bundled iframe worker.
 */
export function installMonacoEnvironment(): void {
  window.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      const url = monacoWorkerModuleUrl(label);
      if (!url) return undefined;
      return new Worker(url, { type: "module" });
    },
    getWorkerUrl(_moduleId: string, label: string) {
      return monacoWorkerModuleUrl(label)?.toString();
    },
  };
}

installMonacoEnvironment();
