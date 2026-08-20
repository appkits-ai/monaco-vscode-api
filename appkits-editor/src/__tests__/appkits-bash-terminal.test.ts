import { describe, expect, it, vi } from "vitest";
import {
  AppKitsBashTerminalOverlay,
  BASH_PLUGIN_SLUG,
  BASH_TERMINAL_OVERLAY_ID,
  startBashTerminalSession,
} from "../appkits-bash-terminal-session";
import { AppKitsRuntimeEnsureError } from "../appkits-runtime-ensure";

describe("isolate Bash terminal overlay", () => {
  it("calls runtime.ensure once and overlays the admitted origin", async () => {
    const writes: string[] = [];
    const show = vi.fn();
    const ensure = vi.fn(async () => ({
      originUrl: "https://sess-runtime.w3kits.com/",
      startUrl:
        "https://appkits.ai/api/workspaces/runtime/proxy/plugin-bash/agent-runtime/",
    }));

    await startBashTerminalSession({
      write: (data) => writes.push(data),
      ensure,
      overlay: { show },
    });

    expect(ensure).toHaveBeenCalledTimes(1);
    expect(ensure).toHaveBeenCalledWith({ pluginSlug: BASH_PLUGIN_SLUG });
    expect(show).toHaveBeenCalledWith("https://sess-runtime.w3kits.com/");
    expect(writes.join("")).toContain("Starting isolate Bash");
    expect(writes.join("")).toContain("Isolate Bash is ready");
  });

  it("writes the host failure instead of faking a local shell", async () => {
    const writes: string[] = [];

    await startBashTerminalSession({
      write: (data) => writes.push(data),
      ensure: async () => {
        throw new AppKitsRuntimeEnsureError(
          "plugin_not_installed",
          "Install Bash from Marketplace first.",
        );
      },
      overlay: { show: vi.fn() },
    });

    expect(writes.join("")).toContain(
      "Failed to start isolate Bash (plugin_not_installed)",
    );
    expect(writes.join("")).not.toContain("$");
  });

  it("reuses one iframe when the isolate origin does not change", () => {
    document.body.innerHTML = '<div class="terminal-outer-container"></div>';
    const overlay = new AppKitsBashTerminalOverlay(document);

    overlay.show("https://sess-runtime.w3kits.com/");
    overlay.show("https://sess-runtime.w3kits.com/");

    const iframes = document.querySelectorAll(
      `#${BASH_TERMINAL_OVERLAY_ID}`,
    );
    expect(iframes).toHaveLength(1);
    expect(iframes[0]?.getAttribute("src")).toBe(
      "https://sess-runtime.w3kits.com/",
    );
  });
});
