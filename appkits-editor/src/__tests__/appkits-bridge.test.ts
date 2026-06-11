import { describe, expect, it, vi } from "vitest";
import { AppKitsBridge } from "../appkits-bridge";

describe("AppKitsBridge", () => {
  it("uses the AppKits desktop SDK for file and window capabilities", async () => {
    const posted: unknown[] = [];
    const parent = {
      postMessage: vi.fn((message: unknown) => {
        posted.push(message);
      }),
    };
    const bridge = new AppKitsBridge(window, {
      parent,
      requestTimeoutMs: 5000,
      createRequestId: vi
        .fn()
        .mockReturnValueOnce("read_1")
        .mockReturnValueOnce("write_1")
        .mockReturnValueOnce("title_1"),
    });

    const readPromise = bridge.readFile("/home/agent/workspace/main.ts");
    const readRequest = posted.at(-1) as {
      requestId: string;
      type: string;
      method: string;
      params: { path: string };
    };
    expect(readRequest).toMatchObject({
      type: "APPKITS_DESKTOP_REQUEST",
      method: "files.read",
      params: { path: "/home/agent/workspace/main.ts" },
    });
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
      method: string;
      params: { path: string; body: string; contentType: string };
    };
    expect(writeRequest).toMatchObject({
      type: "APPKITS_DESKTOP_REQUEST",
      method: "files.write",
      params: {
        path: "/home/agent/workspace/main.ts",
        body: "hello from AppKits",
        contentType: "text/plain",
      },
    });
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

    bridge.postWindowTitle("main.ts");
    expect(posted.at(-1)).toMatchObject({
      type: "APPKITS_DESKTOP_REQUEST",
      method: "window.setTitle",
      params: { title: "main.ts" },
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "APPKITS_RESPONSE",
          version: 1,
          requestId: "title_1",
          ok: true,
          data: { title: "main.ts" },
        },
      }),
    );
    bridge.dispose();
  });
});
