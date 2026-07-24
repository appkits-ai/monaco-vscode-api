import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPKITS_WORKSPACE_FILE,
  APPKITS_WORKSPACE_PRESENTATION_ROOT,
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
  });

  it("exposes virtual /home with only the authoritative agent child", async () => {
    const provider = new AppKitsFileSystemProvider();

    await expect(provider.stat(uri(APPKITS_WORKSPACE_PRESENTATION_ROOT))).resolves.toMatchObject({
      type: FileType.Directory,
    });
    await expect(provider.readdir(uri("/"))).resolves.toEqual([
      ["home", FileType.Directory],
    ]);
    await expect(
      provider.readdir(uri(APPKITS_WORKSPACE_PRESENTATION_ROOT)),
    ).resolves.toEqual([["agent", FileType.Directory]]);
    expect(
      JSON.parse(
        decodeUtf8(await provider.readFile(uri(APPKITS_WORKSPACE_FILE))),
      ),
    ).toEqual({
      folders: [
        {
          name: "home",
          path: APPKITS_WORKSPACE_PRESENTATION_ROOT,
        },
      ],
    });
    expect(sdk.FileSystem.list).not.toHaveBeenCalled();
    expect(sdk.FileSystem.read).not.toHaveBeenCalled();
  });

  it("never sends virtual presentation paths to the AppKits SDK", async () => {
    const provider = new AppKitsFileSystemProvider();
    const presentationRoot = uri(APPKITS_WORKSPACE_PRESENTATION_ROOT);

    await expect(provider.readFile(presentationRoot)).rejects.toMatchObject({
      code: "NoPermissions",
    });
    await expect(
      provider.writeFile(presentationRoot, new Uint8Array(), {
        create: false,
        overwrite: true,
        atomic: false,
        unlock: false,
      }),
    ).rejects.toMatchObject({ code: "NoPermissions" });
    await expect(provider.mkdir(presentationRoot)).rejects.toMatchObject({
      code: "NoPermissions",
    });
    await expect(
      provider.delete(presentationRoot, {
        recursive: true,
        useTrash: false,
        atomic: false,
      }),
    ).rejects.toMatchObject({ code: "NoPermissions" });
    await expect(
      provider.rename(presentationRoot, uri(APPKITS_WORKSPACE_ROOT), {
        overwrite: false,
      }),
    ).rejects.toMatchObject({ code: "NoPermissions" });

    expect(sdk.FileSystem.read).not.toHaveBeenCalled();
    expect(sdk.FileSystem.write).not.toHaveBeenCalled();
    expect(sdk.FileSystem.mkdir).not.toHaveBeenCalled();
    expect(sdk.FileSystem.delete).not.toHaveBeenCalled();
    expect(sdk.FileSystem.move).not.toHaveBeenCalled();
  });

  it("keeps canonical file operations under /home/agent", async () => {
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

    await provider.mkdir(uri("/home/agent/new-folder"));
    await provider.rename(
      uri("/home/agent/app.ts"),
      uri("/home/agent/new-folder/app.ts"),
      { overwrite: false },
    );
    await provider.delete(uri("/home/agent/new-folder/app.ts"), {
      recursive: false,
      useTrash: false,
      atomic: false,
    });
    expect(sdk.FileSystem.mkdir).toHaveBeenCalledWith(
      "/home/agent/new-folder",
    );
    expect(sdk.FileSystem.move).toHaveBeenCalledWith(
      "/home/agent/app.ts",
      "/home/agent/new-folder/app.ts",
    );
    expect(sdk.FileSystem.delete).toHaveBeenCalledWith(
      "/home/agent/new-folder/app.ts",
    );
  });

  it("stats hidden launch targets even when their parents are absent from cached listings", async () => {
    sdk.FileSystem.list
      .mockResolvedValueOnce({ entries: [] })
      .mockResolvedValueOnce({ entries: [{ path: "/home/agent/.config/appkits/desktop-icons.json", kind: "file", size: 2 }] });
    sdk.FileSystem.read
      .mockRejectedValueOnce(new Error("Is a directory"))
      .mockResolvedValueOnce({
        path: "/home/agent/.config/appkits/desktop-icons.json",
        body: "{}",
        contentType: "application/json",
      });

    const provider = new AppKitsFileSystemProvider();
    await expect(provider.stat(uri("/home/agent/.config/appkits"))).resolves.toMatchObject({
      type: FileType.Directory,
    });
    await expect(provider.stat(uri("/.config/appkits/desktop-icons.json"))).resolves.toMatchObject({
      type: FileType.File,
      size: 2,
    });
    await expect(provider.readFile(uri("/.config/appkits/desktop-icons.json"))).resolves.toEqual(
      new TextEncoder().encode("{}"),
    );
    expect(sdk.FileSystem.read).toHaveBeenLastCalledWith("/home/agent/.config/appkits/desktop-icons.json");
  });
});

function uri(path: string): { path: string } {
  return { path };
}
