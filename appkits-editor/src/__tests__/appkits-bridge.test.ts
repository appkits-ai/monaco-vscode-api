import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppKitsBridge } from "../appkits-bridge";

const sdk = vi.hoisted(() => ({
  FileSystem: {
    list: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
  },
  Launch: {
    params: vi.fn(),
  },
  Window: {
    setTitle: vi.fn(),
  },
}));

vi.mock("@appkits-ai/sdk/client", () => sdk);

describe("AppKitsBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads and writes through the AppKits SDK filesystem", async () => {
    sdk.FileSystem.list.mockResolvedValueOnce({
      entries: [
        {
          path: "/home/agent/app.ts",
          name: "app.ts",
          kind: "file",
          contentType: "text/typescript",
          local: true,
        },
      ],
    });
    sdk.FileSystem.read.mockResolvedValueOnce({
      path: "/home/agent/workspace/main.ts",
      body: "hello",
      contentType: "text/plain",
      local: true,
    });
    sdk.FileSystem.write.mockResolvedValueOnce({
      path: "/home/agent/workspace/main.ts",
      contentType: "text/plain",
    });

    const bridge = new AppKitsBridge();

    await expect(bridge.listWorkspaceFiles()).resolves.toMatchObject({
      entries: [{ path: "/home/agent/app.ts", kind: "file" }],
    });
    expect(sdk.FileSystem.list).toHaveBeenCalledWith("/home/agent");

    await expect(bridge.readFile("/home/agent/workspace/main.ts")).resolves.toMatchObject({
      body: "hello",
    });
    expect(sdk.FileSystem.read).toHaveBeenCalledWith("/home/agent/workspace/main.ts");

    await expect(bridge.writeFile({
      path: "/home/agent/workspace/main.ts",
      body: "hello from AppKits",
      contentType: "text/plain",
    })).resolves.toMatchObject({
      path: "/home/agent/workspace/main.ts",
    });
    expect(sdk.FileSystem.write).toHaveBeenCalledWith({
      path: "/home/agent/workspace/main.ts",
      body: "hello from AppKits",
      contentType: "text/plain",
    });
  });

  it("reads launch params and sets the window title through the SDK", async () => {
    sdk.Launch.params.mockResolvedValueOnce({ appkitsOpenFile: { path: "/home/agent/app.ts" } });
    sdk.Window.setTitle.mockResolvedValueOnce({ title: "app.ts" });
    const bridge = new AppKitsBridge();

    await expect(bridge.launchParams()).resolves.toEqual({
      appkitsOpenFile: { path: "/home/agent/app.ts" },
    });
    bridge.postWindowTitle("app.ts");
    expect(sdk.Window.setTitle).toHaveBeenCalledWith("app.ts");
  });
});
