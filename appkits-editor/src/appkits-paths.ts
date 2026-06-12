export const APPKITS_WORKSPACE_ROOT = "/home/agent";
export const APPKITS_WORKSPACE_FILE = "/appkits.code-workspace";

export function normalizeAppKitsPath(path: string): string {
  const value = path.trim().replace(/\\/g, "/");
  if (!value) return APPKITS_WORKSPACE_ROOT;
  if (value === APPKITS_WORKSPACE_FILE) return APPKITS_WORKSPACE_FILE;

  const normalized = normalizeAbsolutePath(value.startsWith("/") ? value : `${APPKITS_WORKSPACE_ROOT}/${value}`);
  if (normalized === APPKITS_WORKSPACE_ROOT || normalized.startsWith(`${APPKITS_WORKSPACE_ROOT}/`)) {
    return normalized;
  }
  return normalizeAbsolutePath(`${APPKITS_WORKSPACE_ROOT}${normalized}`);
}

function normalizeAbsolutePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join("/")}`;
}
