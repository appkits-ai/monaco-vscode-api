export const WORKSPACE_ROOT = "/home/agent";

export interface WorkspaceEntry {
  path: string;
  name: string;
  kind: "file" | "directory";
  contentType?: string;
  size?: number;
  updatedAt?: string;
}

export interface WorkspaceTreeNode extends WorkspaceEntry {
  kind: "directory";
  children: WorkspaceTreeNode[];
  files: WorkspaceEntry[];
}

export function normalizeWorkspacePath(path: string | undefined): string {
  const normalized = (path || WORKSPACE_ROOT)
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/+$/, "");
  if (!normalized || normalized === "/" || normalized === "/home") {
    return WORKSPACE_ROOT;
  }
  return normalized.startsWith(WORKSPACE_ROOT)
    ? normalized
    : `${WORKSPACE_ROOT}/${normalized.replace(/^\/+/, "")}`;
}

export function filenameFromPath(path: string): string {
  const normalized = normalizeWorkspacePath(path);
  if (normalized === WORKSPACE_ROOT) return "agent";
  return normalized.split("/").pop() || normalized;
}

export function parentPath(path: string): string {
  const normalized = normalizeWorkspacePath(path);
  if (normalized === WORKSPACE_ROOT) return WORKSPACE_ROOT;
  const parent = normalized.slice(0, normalized.lastIndexOf("/"));
  return parent && parent.startsWith(WORKSPACE_ROOT) ? parent : WORKSPACE_ROOT;
}

export function sortWorkspaceEntries<T extends Pick<WorkspaceEntry, "kind" | "name">>(
  entries: T[],
): T[] {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

export function childEntries(
  entries: WorkspaceEntry[],
  directory: string,
): WorkspaceEntry[] {
  const root = normalizeWorkspacePath(directory);
  return sortWorkspaceEntries(
    entries.filter((entry) => parentPath(entry.path) === root),
  );
}

export function buildWorkspaceTree(entries: WorkspaceEntry[]): WorkspaceTreeNode {
  const root: WorkspaceTreeNode = {
    path: WORKSPACE_ROOT,
    name: "agent",
    kind: "directory",
    children: [],
    files: [],
  };
  const directories = new Map<string, WorkspaceTreeNode>([[WORKSPACE_ROOT, root]]);

  for (const entry of sortWorkspaceEntries(entries)) {
    if (entry.kind !== "directory") continue;
    let current = normalizeWorkspacePath(entry.path);
    const stack: string[] = [];
    while (current.startsWith(WORKSPACE_ROOT) && current !== WORKSPACE_ROOT) {
      stack.unshift(current);
      current = parentPath(current);
    }
    for (const path of stack) {
      if (directories.has(path)) continue;
      const node: WorkspaceTreeNode = {
        path,
        name: filenameFromPath(path),
        kind: "directory",
        children: [],
        files: [],
      };
      directories.set(path, node);
      directories.get(parentPath(path))?.children.push(node);
    }
  }

  for (const entry of entries) {
    if (entry.kind === "directory") continue;
    directories.get(parentPath(entry.path))?.files.push(entry);
  }

  for (const node of directories.values()) {
    node.children = sortWorkspaceEntries(node.children);
    node.files = sortWorkspaceEntries(node.files);
  }

  return root;
}

export function openFileFromPath(path: string, entries: WorkspaceEntry[]) {
  const normalized = normalizeWorkspacePath(path);
  const entry = entries.find((item) => item.path === normalized);
  return {
    version: 1 as const,
    role: "editor",
    scope: "desktop-file" as const,
    path: normalized,
    name: entry?.name || filenameFromPath(normalized),
    kind: "file" as const,
    contentType: entry?.contentType || "application/octet-stream",
    local: false,
  };
}
