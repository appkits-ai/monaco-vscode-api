export const APPKITS_LAUNCH_PARAMS = "APPKITS_LAUNCH_PARAMS";
export const APPKITS_OPEN_FILE = "APPKITS_OPEN_FILE";

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
