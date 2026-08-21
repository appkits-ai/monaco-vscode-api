/**
 * 在 vscode 导入前安装 Monaco worker：已认领标签走 Vite 打包的 ESM 文件。
 * Installs Monaco workers before vscode imports. Claimed labels use Vite-bundled
 * ESM worker files so the worker graph stays on a hierarchical URL.
 *
 * @owner appkits-editor
 * @module vscode-editor
 */
import editorWorkerUrl from "monaco-editor/esm/vs/editor/editor.worker.js?worker&url";
import extensionHostWorkerUrl from "@codingame/monaco-vscode-api/workers/extensionHost.worker?worker&url";
import textmateWorkerUrl from "@codingame/monaco-vscode-textmate-service-override/worker?worker&url";

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
 * 判断 URL 是否是可给 Worker / import() 使用的分层地址，而不是 data: 残桩。
 * Returns whether a worker URL is hierarchical for Worker / import(), not a data: stub.
 */
export function isBundledWorkerUrl(url: string): boolean {
  return url.length > 0 && !url.startsWith("data:");
}

/**
 * 解析已认领 worker 标签的打包模块 URL；未认领时不返回 URL。
 * Resolves the bundled module URL for a claimed worker label and returns
 * null when the official bundler must keep the descriptor.
 */
export function monacoWorkerModuleUrl(label: string): string | null {
  const kind = monacoWorkerKind(label);
  const url =
    kind === "textmate"
      ? textmateWorkerUrl
      : kind === "extensionHost"
        ? extensionHostWorkerUrl
        : kind === "editor"
          ? editorWorkerUrl
          : null;
  if (url === null) return null;
  if (!isBundledWorkerUrl(url)) {
    throw new Error(
      `Monaco worker ${label} must be a bundled hierarchical URL, not a data: stub.`,
    );
  }
  return url;
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
      return monacoWorkerModuleUrl(label) ?? undefined;
    },
    getWorkerOptions(_moduleId: string, label: string) {
      return monacoWorkerOptions(label);
    },
  };
}

installMonacoEnvironment();
