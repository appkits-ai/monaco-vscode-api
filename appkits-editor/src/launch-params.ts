import type { AppKitsOpenFile } from "./types";
import { normalizeAppKitsPath } from "./appkits-paths";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function normalizeOpenFile(value: unknown): AppKitsOpenFile | null {
  if (!isRecord(value)) return null;
  if (
    value.scope !== "desktop-file" ||
    value.kind !== "file" ||
    typeof value.path !== "string" ||
    typeof value.name !== "string"
  ) {
    return null;
  }
  return {
    version: 1,
    role: typeof value.role === "string" ? value.role : "viewer",
    scope: "desktop-file",
    path: normalizeAppKitsPath(value.path),
    name: value.name,
    kind: "file",
    contentType:
      typeof value.contentType === "string" && value.contentType
        ? value.contentType
        : "application/octet-stream",
    local: value.local === true,
  };
}

export function openFileFromLaunchParams(
  params: unknown,
): AppKitsOpenFile | null {
  if (!isRecord(params)) return null;
  return normalizeOpenFile(params.appkitsOpenFile);
}
