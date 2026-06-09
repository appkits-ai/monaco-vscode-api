import { describe, expect, it, vi } from "vitest";
import { AppKitsBridge } from "../appkits-bridge";

describe("AppKitsBridge", () => {
  it("reads and writes through request/response postMessage", async () => {
    vi.useFakeTimers();
    const posted: unknown[] = [];
    const bridge = new AppKitsBridge(window, {
      requestIdPrefix: "test",
      requestTimeoutMs: 5000,
    });
    vi.spyOn(window.parent, "postMessage").mockImplementation((message) => {
      posted.push(message);
    });

    const readPromise = bridge.readFile("/home/agent/workspace/main.ts");
    const readRequest = posted.at(-1) as { requestId: string; type: string };
    expect(readRequest.type).toBe("APPKITS_FILE_READ");
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "APPKITS_RESPONSE",
          version: 1,
          requestId: readRequest.requestId,
          ok: true,
          data: {
            path: "/home/agent/workspace/main.ts",
            body: "hello",
            contentType: "text/plain",
            local: true,
          },
        },
      }),
    );
    await expect(readPromise).resolves.toMatchObject({ body: "hello" });

    const writePromise = bridge.writeFile({
      path: "/home/agent/workspace/main.ts",
      body: "hello from AppKits",
      contentType: "text/plain",
    });
    const writeRequest = posted.at(-1) as {
      requestId: string;
      type: string;
      bodyBase64: string;
    };
    expect(writeRequest.type).toBe("APPKITS_FILE_WRITE");
    expect(writeRequest.bodyBase64).toBe("aGVsbG8gZnJvbSBBcHBLaXRz");
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "APPKITS_RESPONSE",
          version: 1,
          requestId: writeRequest.requestId,
          ok: true,
          data: { path: "/home/agent/workspace/main.ts", contentType: "text/plain" },
        },
      }),
    );
    await expect(writePromise).resolves.toMatchObject({
      path: "/home/agent/workspace/main.ts",
    });
    bridge.dispose();
    vi.useRealTimers();
  });
});
