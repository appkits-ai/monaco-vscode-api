import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APPKITS_DESKTOP_REQUEST,
  APPKITS_RESPONSE,
  RUNTIME_ENSURE_METHOD,
  RUNTIME_ENSURE_TIMEOUT_MS,
  createRuntimeEnsureRequest,
  ensurePluginRuntime,
  parseRuntimeEnsureResult,
} from "../appkits-runtime-ensure";

describe("runtime.ensure host request", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the unpublished desktop envelope without the published SDK union", () => {
    expect(
      createRuntimeEnsureRequest({
        requestId: "req_runtime_ensure",
        pluginSlug: "bash",
      }),
    ).toEqual({
      type: APPKITS_DESKTOP_REQUEST,
      version: 1,
      requestId: "req_runtime_ensure",
      method: RUNTIME_ENSURE_METHOD,
      params: { pluginSlug: "bash" },
    });
  });

  it("parses the admitted isolate origin", () => {
    expect(
      parseRuntimeEnsureResult({
        originUrl: "https://sess-runtime.w3kits.com/",
        startUrl:
          "https://appkits.ai/api/workspaces/runtime/proxy/plugin-bash/agent-runtime/",
      }),
    ).toEqual({
      originUrl: "https://sess-runtime.w3kits.com/",
      startUrl:
        "https://appkits.ai/api/workspaces/runtime/proxy/plugin-bash/agent-runtime/",
    });
  });

  it("sends runtime.ensure and resolves the host response", async () => {
    const parent = {
      postMessage: vi.fn(),
    };
    const listeners = new Set<(event: MessageEvent) => void>();
    const win = {
      parent,
      addEventListener: (
        _type: "message",
        listener: (event: MessageEvent) => void,
      ) => {
        listeners.add(listener);
      },
      removeEventListener: (
        _type: "message",
        listener: (event: MessageEvent) => void,
      ) => {
        listeners.delete(listener);
      },
    };

    const pending = ensurePluginRuntime({
      pluginSlug: "bash",
      win,
      createRequestId: () => "req_runtime_ensure",
    });

    expect(parent.postMessage).toHaveBeenCalledWith(
      createRuntimeEnsureRequest({
        requestId: "req_runtime_ensure",
        pluginSlug: "bash",
      }),
      "*",
    );

    for (const listener of listeners) {
      listener({
        data: {
          type: APPKITS_RESPONSE,
          requestId: "req_runtime_ensure",
          ok: true,
          data: {
            originUrl: "https://sess-runtime.w3kits.com/",
            startUrl:
              "https://appkits.ai/api/workspaces/runtime/proxy/plugin-bash/agent-runtime/",
          },
        },
      } as MessageEvent);
    }

    await expect(pending).resolves.toEqual({
      originUrl: "https://sess-runtime.w3kits.com/",
      startUrl:
        "https://appkits.ai/api/workspaces/runtime/proxy/plugin-bash/agent-runtime/",
    });
    expect(RUNTIME_ENSURE_TIMEOUT_MS).toBe(90_000);
  });

  it("rejects a missing plugin slug", async () => {
    await expect(ensurePluginRuntime({ pluginSlug: "  " })).rejects.toMatchObject({
      code: "invalid_plugin",
    });
  });
});
