import type { W3KitsOpenFile } from "./types";
import { W3KITS_LAUNCH_PARAMS, W3KITS_OPEN_FILE } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function normalizeOpenFile(value: unknown): W3KitsOpenFile | null {
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
    path: value.path,
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
): W3KitsOpenFile | null {
  if (!isRecord(params)) return null;
  return normalizeOpenFile(params.w3kitsOpenFile);
}

export function openFileFromHostMessage(
  message: unknown,
): W3KitsOpenFile | null {
  if (!isRecord(message)) return null;
  if (message.type === W3KITS_OPEN_FILE) {
    return normalizeOpenFile(message.file);
  }
  if (message.type === W3KITS_LAUNCH_PARAMS) {
    return openFileFromLaunchParams(message.params);
  }
  return null;
}
