/**
 * 在 vscode 导入前安装 Monaco worker：已打包标签走 ESM，未认领标签交给官方 bundler。
 * Installs Monaco workers before vscode imports. Claimed labels are ESM
 * modules; unclaimed labels keep official bundler entries such as the
 * extension-host iframe HTML.
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

const MODULE_WORKER_OPTIONS: WorkerOptions = { type: "module" };

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
 * 已认领的 ESM worker 必须带 type:module，否则 iframe bootstrap 会走 importScripts。
 * Claimed ESM workers advertise type:module so the extension-host iframe
 * uses await import instead of classic importScripts.
 */
export function monacoWorkerOptions(label: string): WorkerOptions | undefined {
  return monacoWorkerKind(label) ? MODULE_WORKER_OPTIONS : undefined;
}

/**
 * 写入 window.MonacoEnvironment。未认领标签三项都返回 undefined。
 * Writes window.MonacoEnvironment. Unclaimed labels return undefined from
 * getWorker, getWorkerUrl, and getWorkerOptions so the iframe HTML stays
 * on esmModuleLocationBundler. getWorkerUrl without getWorkerOptions.type
 * module would make webWorkerExtensionHostIframe.html importScripts the
 * ESM extension-host worker (LocalWebWorker exit 81).
 */
export function installMonacoEnvironment(): void {
  window.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      const url = monacoWorkerModuleUrl(label);
      const options = monacoWorkerOptions(label);
      if (!url || !options) return undefined;
      return new Worker(url, options);
    },
    getWorkerUrl(_moduleId: string, label: string) {
      return monacoWorkerModuleUrl(label)?.toString();
    },
    getWorkerOptions(_moduleId: string, label: string) {
      return monacoWorkerOptions(label);
    },
  };
}

installMonacoEnvironment();
