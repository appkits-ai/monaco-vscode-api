import { describe, expect, it, vi } from "vitest";
import type { AppKitsWorkspaceEntry } from "../types";
import { WorkspaceBrowser, workspaceEntryToOpenFile } from "../workspace-browser";

function elements() {
  document.body.innerHTML = `
    <button id="files"></button>
    <div id="drawer" hidden></div>
    <div id="backdrop" hidden></div>
    <div id="tree"></div>
  `;
  return {
    filesButton: document.getElementById("files") as HTMLButtonElement,
    drawer: document.getElementById("drawer")!,
    backdrop: document.getElementById("backdrop")!,
    tree: document.getElementById("tree")!,
  };
}

describe("WorkspaceBrowser", () => {
  it("lists /home/agent files and opens a selected file", async () => {
    const onOpenFile = vi.fn();
    const browser = new WorkspaceBrowser({
      bridge: {
        listWorkspaceFiles: vi.fn(async () => ({
          entries: [
            { path: "/home/agent/app.ts", name: "app.ts", kind: "file", contentType: "text/typescript", local: true },
            { path: "/home/agent/nested/skip.ts", name: "skip.ts", kind: "file" },
            { path: "/tmp/skip.ts", name: "skip.ts", kind: "file" },
          ] satisfies AppKitsWorkspaceEntry[],
        })),
      },
      elements: elements(),
      onOpenFile,
    });

    await browser.open();
    const items = [...document.querySelectorAll<HTMLButtonElement>(".tree-item")];
    expect(items.map((item) => item.textContent)).toEqual(["app.ts"]);
    items[0]!.click();
    expect(onOpenFile).toHaveBeenCalledWith({
      version: 1,
      role: "editor",
      scope: "desktop-file",
      path: "/home/agent/app.ts",
      name: "app.ts",
      kind: "file",
      contentType: "text/typescript",
      local: true,
    });
    expect(document.getElementById("drawer")?.hidden).toBe(true);
  });

  it("keeps the Files drawer usable when no scoped file is open", async () => {
    const browser = new WorkspaceBrowser({
      bridge: {
        listWorkspaceFiles: vi.fn(async () => ({
          entries: [
            { path: "/home/agent/index.ts", name: "index.ts", kind: "file" },
          ] satisfies AppKitsWorkspaceEntry[],
        })),
      },
      elements: elements(),
      onOpenFile: vi.fn(),
    });

    await browser.open();
    expect(document.getElementById("drawer")?.hidden).toBe(false);
    expect(document.querySelector(".tree-item")?.textContent).toBe("index.ts");
  });

  it("shows SDK file loading errors without closing the drawer", async () => {
    const browser = new WorkspaceBrowser({
      bridge: {
        listWorkspaceFiles: vi.fn(async () => {
          throw new Error("AppKits desktop request failed.");
        }),
      },
      elements: elements(),
      onOpenFile: vi.fn(),
    });

    await browser.open();
    expect(document.getElementById("drawer")?.hidden).toBe(false);
    expect(document.querySelector(".tree-empty")?.textContent).toBe(
      "AppKits desktop request failed.",
    );
  });

  it("converts workspace entries to AppKits open-file launch params", () => {
    expect(
      workspaceEntryToOpenFile({
        path: "/home/agent/package.json",
        name: "package.json",
        kind: "file",
        contentType: "application/json",
      }),
    ).toMatchObject({
      version: 1,
      role: "editor",
      scope: "desktop-file",
      path: "/home/agent/package.json",
      name: "package.json",
      kind: "file",
    });
  });
});
