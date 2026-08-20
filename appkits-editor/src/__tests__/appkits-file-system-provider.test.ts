import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPKITS_WORKSPACE_FILE,
  APPKITS_WORKSPACE_ROOT,
  AppKitsFileSystemProvider,
  decodeUtf8,
} from "../appkits-file-system-provider";

const mockFiles = vi.hoisted(() => ({
  FileType: {
    File: 1,
    Directory: 2,
  } as const,
}));

const FileType = mockFiles.FileType;

vi.mock("@codingame/monaco-vscode-files-service-override", () => ({
  FileChangeType: {
    UPDATED: 0,
    ADDED: 1,
    DELETED: 2,
  },
  FileSystemProviderCapabilities: {
    FileReadWrite: 2,
    PathCaseSensitive: 1024,
  },
  FileSystemProviderError: {
    create: (message: string, code: string) =>
      Object.assign(new Error(message), { code }),
  },
  FileSystemProviderErrorCode: {
    FileExists: "EntryExists",
    FileNotFound: "EntryNotFound",
    FileNotADirectory: "EntryNotADirectory",
    NoPermissions: "NoPermissions",
  },
  FileType: mockFiles.FileType,
}));

const sdk = vi.hoisted(() => ({
  FileSystem: {
    list: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
    delete: vi.fn(),
    mkdir: vi.fn(),
    move: vi.fn(),
  },
}));

vi.mock("@appkits-ai/sdk/client", () => sdk);

describe("AppKitsFileSystemProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.FileSystem.list.mockReset();
    sdk.FileSystem.read.mockReset();
    sdk.FileSystem.write.mockReset();
    sdk.FileSystem.delete.mockReset();
    sdk.FileSystem.mkdir.mockReset();
    sdk.FileSystem.move.mockReset();
  });

  it("exposes /home/agent as a VS Code workspace folder", async () => {
    const provider = new AppKitsFileSystemProvider();

    await expect(provider.readdir(uri("/"))).resolves.toEqual([
      ["home", FileType.Directory],
    ]);
    await expect(provider.readdir(uri("/home"))).resolves.toEqual([
      ["agent", FileType.Directory],
    ]);
    expect(decodeUtf8(await provider.readFile(uri(APPKITS_WORKSPACE_FILE)))).toContain(
      APPKITS_WORKSPACE_ROOT,
    );
  });

  it("lists, reads, and writes through the AppKits SDK filesystem", async () => {
    sdk.FileSystem.list.mockResolvedValueOnce({
      entries: [
        { path: "/home/agent/workspace", name: "workspace", kind: "directory" },
        { path: "/home/agent/app.ts", name: "app.ts", kind: "file", size: 12 },
      ],
    });
    sdk.FileSystem.read.mockResolvedValueOnce({
      path: "/home/agent/app.ts",
      body: "let value = 1;\n",
      contentType: "text/typescript",
    });
    sdk.FileSystem.write.mockResolvedValueOnce({ path: "/home/agent/app.ts" });

    const provider = new AppKitsFileSystemProvider();
    await expect(provider.readdir(uri("/home/agent"))).resolves.toEqual([
      ["workspace", FileType.Directory],
      ["app.ts", FileType.File],
      [".vscode", FileType.Directory],
    ]);
    expect(sdk.FileSystem.list).toHaveBeenCalledWith("/home/agent");

    await expect(provider.readFile(uri("/home/agent/app.ts"))).resolves.toEqual(
      new TextEncoder().encode("let value = 1;\n"),
    );
    await provider.writeFile(
      uri("/home/agent/app.ts"),
      new TextEncoder().encode("let value = 2;\n"),
      { create: false, overwrite: true, atomic: false, unlock: false },
    );
    expect(sdk.FileSystem.write).toHaveBeenCalledWith({
      path: "/home/agent/app.ts",
      bodyBase64: btoa("let value = 2;\n"),
      contentType: "text/typescript",
    });
  });

  it("exposes empty optional .vscode JSON when Computer has no folder", async () => {
    sdk.FileSystem.list.mockImplementation(async (path: string) => {
      if (path === "/home/agent") return { entries: [] };
      throw new Error("not found: /home/agent/.vscode");
    });
    sdk.FileSystem.read.mockRejectedValue(new Error("not found: /home/agent/.vscode"));

    const provider = new AppKitsFileSystemProvider();
    await expect(provider.readdir(uri("/home/agent"))).resolves.toEqual([
      [".vscode", FileType.Directory],
    ]);
    await expect(provider.stat(uri("\\home\\agent\\.vscode\\settings.json"))).resolves.toMatchObject({
      type: FileType.File,
    });
    expect(decodeUtf8(await provider.readFile(uri("/home/agent/.vscode/settings.json")))).toBe(
      "{}\n",
    );
    expect(sdk.FileSystem.read).toHaveBeenCalledWith("/home/agent/.vscode/settings.json");
  });
});

function uri(path: string): { path: string } {
  return { path };
}
