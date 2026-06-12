import { describe, expect, it, vi } from "vitest";
const FileType = { File: 1, Directory: 2 };
import { AppKitsVfsProvider } from "../appkits-vfs-provider";

function uri(path: string) {
  return { scheme: "file", path } as never;
}

const entries = [
  { path: "/home/agent/project", name: "project", kind: "directory" as const },
  { path: "/home/agent/project/app.ts", name: "app.ts", kind: "file" as const, size: 12 },
];

describe("AppKitsVfsProvider", () => {
  it("backs stat, readdir, readFile, and writeFile with AppKits FileSystem", async () => {
    const client = {
      listFiles: vi.fn(async () => entries),
      readFileBytes: vi.fn(async () => new TextEncoder().encode("hello")),
      writeFileBytes: vi.fn(async () => ({ path: "/home/agent/project/app.ts", contentType: "text/plain", local: false })),
      mkdir: vi.fn(),
      deletePath: vi.fn(),
      renamePath: vi.fn(),
    };
    const provider = new AppKitsVfsProvider(client);

    await expect(provider.stat(uri("/home/agent/project/app.ts"))).resolves.toMatchObject({
      type: FileType.File,
      size: 12,
    });
    await expect(provider.readdir(uri("/home/agent/project"))).resolves.toEqual([
      ["app.ts", FileType.File],
    ]);
    await expect(provider.readFile(uri("/home/agent/project/app.ts"))).resolves.toEqual(
      new TextEncoder().encode("hello"),
    );
    await provider.writeFile(uri("/home/agent/project/app.ts"), new TextEncoder().encode("next"), { create: true, overwrite: true, unlock: false, atomic: false });
    expect(client.writeFileBytes).toHaveBeenCalledWith(
      "/home/agent/project/app.ts",
      new TextEncoder().encode("next"),
      "text/plain;charset=UTF-8",
    );
  });
});
