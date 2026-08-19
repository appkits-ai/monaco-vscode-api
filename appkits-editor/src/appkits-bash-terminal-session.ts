/**
 * 负责 isolate Bash 会话启动与 Terminal 面板覆盖，不依赖 monaco terminal override。
 * Owns isolate Bash session start and Terminal panel overlay without the monaco terminal override.
 */
import {
  AppKitsRuntimeEnsureError,
  type RuntimeEnsureSuccess,
} from "./appkits-runtime-ensure";

export const BASH_PLUGIN_SLUG = "bash";
export const BASH_TERMINAL_OVERLAY_ID = "appkits-bash-terminal-overlay";

const TERMINAL_HOST_SELECTORS = [
  ".terminal-outer-container",
  ".integrated-terminal",
  "#workbench .part.panel .content",
  "#workbench",
];

export type BashRuntimeEnsure = (input: {
  pluginSlug: string;
}) => Promise<RuntimeEnsureSuccess>;

/** Host document overlay that embeds one admitted isolate Bash iframe. */
export class AppKitsBashTerminalOverlay {
  private iframe: HTMLIFrameElement | null = null;
  private originUrl = "";

  constructor(private readonly doc: Document = document) {}

  /**
   * 在 Terminal 面板上显示或复用 isolate Bash iframe。
   * Shows or reuses the isolate Bash iframe on the Terminal panel.
   */
  show(originUrl: string): void {
    const url = originUrl.trim();
    if (!url) {
      throw new AppKitsRuntimeEnsureError(
        "invalid_runtime",
        "Missing isolate origin URL.",
      );
    }
    const host = this.resolveHost();
    const iframe = this.iframe ?? this.createIframe();
    if (iframe.parentElement !== host) {
      host.appendChild(iframe);
    }
    if (this.originUrl !== url) {
      iframe.src = url;
      this.originUrl = url;
    }
    iframe.hidden = false;
    this.iframe = iframe;
  }

  private createIframe(): HTMLIFrameElement {
    const iframe = this.doc.createElement("iframe");
    iframe.id = BASH_TERMINAL_OVERLAY_ID;
    iframe.title = "Bash";
    iframe.setAttribute("allow", "clipboard-read; clipboard-write");
    iframe.setAttribute("data-appkits-bash-terminal", "true");
    return iframe;
  }

  private resolveHost(): HTMLElement {
    for (const selector of TERMINAL_HOST_SELECTORS) {
      const host = this.doc.querySelector(selector);
      if (!(host instanceof HTMLElement)) continue;
      const position = this.doc.defaultView?.getComputedStyle(host).position;
      if (!position || position === "static") {
        host.style.position = "relative";
      }
      host.style.overflow = "hidden";
      return host;
    }
    throw new AppKitsRuntimeEnsureError(
      "invalid_runtime",
      "Terminal panel host is missing.",
    );
  }
}

/**
 * 启动 isolate Bash 并在成功后覆盖 Terminal 面板。
 * Starts isolate Bash and overlays the Terminal panel on success.
 */
export async function startBashTerminalSession(input: {
  write: (data: string) => void;
  ensure: BashRuntimeEnsure;
  overlay: Pick<AppKitsBashTerminalOverlay, "show">;
}): Promise<void> {
  input.write("Starting isolate Bash...\r\n");
  try {
    const result = await input.ensure({ pluginSlug: BASH_PLUGIN_SLUG });
    input.overlay.show(result.originUrl);
    input.write("Isolate Bash is ready.\r\n");
  } catch (error) {
    const code =
      error instanceof AppKitsRuntimeEnsureError
        ? error.code
        : "request_failed";
    const message = error instanceof Error ? error.message : String(error);
    input.write(`Failed to start isolate Bash (${code}): ${message}\r\n`);
  }
}
