export const APPKITS_BRIDGE_VERSION = 1;
export const APPKITS_RESPONSE = "APPKITS_RESPONSE";
export const APPKITS_FILE_READ = "APPKITS_FILE_READ";
export const APPKITS_FILE_WRITE = "APPKITS_FILE_WRITE";
export const APPKITS_LAUNCH_PARAMS = "APPKITS_LAUNCH_PARAMS";
export const APPKITS_OPEN_FILE = "APPKITS_OPEN_FILE";
export const APPKITS_WINDOW_TITLE = "APPKITS_WINDOW_TITLE";
export const APPKITS_DESKTOP_FS_LIST = "APPKITS_DESKTOP_FS_LIST";

export type AppKitsFileRole = "viewer" | "editor" | "exporter" | string;

export interface AppKitsOpenFile {
  version: 1;
  role: AppKitsFileRole;
  scope: "desktop-file";
  path: string;
  name: string;
  kind: "file";
  contentType: string;
  local: boolean;
}

export interface AppKitsLaunchParams {
  appkitsOpenFile?: AppKitsOpenFile;
}

export interface AppKitsBridgeResponse {
  type: typeof APPKITS_RESPONSE;
  version: 1;
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface AppKitsReadFileResult {
  path: string;
  name?: string;
  body: string;
  bodyBase64?: string;
  contentType: string;
  local: boolean;
}

export interface AppKitsWriteFileResult {
  path: string;
  contentType: string;
  local: boolean;
}


export interface AppKitsWorkspaceEntry {
  path: string;
  name?: string;
  kind: "file" | "directory";
  contentType?: string;
  size?: number;
  local?: boolean;
  temporary?: boolean;
}

export interface AppKitsWorkspaceListResult {
  entries: AppKitsWorkspaceEntry[];
  temporary?: boolean;
}
