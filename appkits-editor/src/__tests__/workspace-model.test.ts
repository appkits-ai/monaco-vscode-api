import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ROOT,
  buildWorkspaceTree,
  childEntries,
  normalizeWorkspacePath,
  openFileFromPath,
  type WorkspaceEntry,
} from "../workspace-model";

const entries: WorkspaceEntry[] = [
  { path: "/home/agent/project", name: "project", kind: "directory" },
  { path: "/home/agent/project/app.ts", name: "app.ts", kind: "file", contentType: "text/typescript" },
  { path: "/home/agent/readme.md", name: "readme.md", kind: "file" },
];

describe("workspace model", () => {
  it("defaults direct launch paths to /home/agent", () => {
    expect(normalizeWorkspacePath(undefined)).toBe(WORKSPACE_ROOT);
    expect(normalizeWorkspacePath("project")).toBe("/home/agent/project");
  });

  it("projects a flat VFS list into a directory tree", () => {
    const tree = buildWorkspaceTree(entries);
    expect(tree.path).toBe(WORKSPACE_ROOT);
    expect(tree.children.map((child) => child.name)).toEqual(["project"]);
    expect(tree.files.map((file) => file.name)).toEqual(["readme.md"]);
  });

  it("creates AppKits open-file input for tree file selection", () => {
    expect(openFileFromPath("/home/agent/project/app.ts", entries)).toMatchObject({
      scope: "desktop-file",
      role: "editor",
      path: "/home/agent/project/app.ts",
      name: "app.ts",
      contentType: "text/typescript",
    });
  });

  it("sorts child entries with folders first", () => {
    expect(childEntries(entries, WORKSPACE_ROOT).map((entry) => entry.name)).toEqual([
      "project",
      "readme.md",
    ]);
  });
});
