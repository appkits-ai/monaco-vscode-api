export const W3KITS_BRIDGE_VERSION = 1;
export const W3KITS_RESPONSE = "W3KITS_RESPONSE";
export const W3KITS_FILE_READ = "W3KITS_FILE_READ";
export const W3KITS_FILE_WRITE = "W3KITS_FILE_WRITE";
export const W3KITS_LAUNCH_PARAMS = "W3KITS_LAUNCH_PARAMS";
export const W3KITS_OPEN_FILE = "W3KITS_OPEN_FILE";
export const W3KITS_WINDOW_TITLE = "W3KITS_WINDOW_TITLE";

export type W3KitsFileRole = "viewer" | "editor" | "exporter" | string;

export interface W3KitsOpenFile {
  version: 1;
  role: W3KitsFileRole;
  scope: "desktop-file";
  path: string;
  name: string;
  kind: "file";
  contentType: string;
  local: boolean;
}

export interface W3KitsLaunchParams {
  w3kitsOpenFile?: W3KitsOpenFile;
}

export interface W3KitsBridgeResponse {
  type: typeof W3KITS_RESPONSE;
  version: 1;
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface W3KitsReadFileResult {
  path: string;
  name?: string;
  body: string;
  bodyBase64?: string;
  contentType: string;
  local: boolean;
}

export interface W3KitsWriteFileResult {
  path: string;
  contentType: string;
  local: boolean;
}
