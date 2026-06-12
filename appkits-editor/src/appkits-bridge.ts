import * as appkits from "@appkits-ai/sdk/client";
import type {
  AppKitsLaunchParams,
  AppKitsReadFileResult,
  AppKitsWorkspaceEntry,
  AppKitsWorkspaceListResult,
  AppKitsWriteFileResult,
} from "./types";
import { base64ToText } from "./base64";

export class AppKitsBridgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppKitsBridgeError";
    this.code = code;
  }
}

export class AppKitsBridge {
  dispose(): void {}

  postReady(): void {
    window.parent?.postMessage({ type: "APP_READY" }, "*");
  }

  postWindowTitle(title: string): void {
    void appkits.Window.setTitle(title).catch(() => undefined);
  }

  async launchParams(): Promise<AppKitsLaunchParams> {
    return (await appkits.Launch.params()) as AppKitsLaunchParams;
  }

  async readFile(path: string): Promise<AppKitsReadFileResult> {
    return parseReadFileResult(await appkits.FileSystem.read(path));
  }

  async listWorkspaceFiles(): Promise<AppKitsWorkspaceListResult> {
    return parseWorkspaceListResult(await appkits.FileSystem.list("/home/agent"));
  }

  async writeFile(input: {
    path: string;
    body: string;
    contentType: string;
  }): Promise<AppKitsWriteFileResult> {
    const data = await appkits.FileSystem.write({
      path: input.path,
      body: input.body,
      contentType: input.contentType,
    });
    return parseWriteFileResult(data, input.path, input.contentType);
  }
}

function parseReadFileResult(value: unknown): AppKitsReadFileResult {
  if (!value || typeof value !== "object") {
    throw new AppKitsBridgeError("invalid_file_response", "Missing file data.");
  }
  const data = value as Partial<AppKitsReadFileResult>;
  if (typeof data.path !== "string") {
    throw new AppKitsBridgeError("invalid_file_response", "Missing file path.");
  }
  const body =
    typeof data.body === "string"
      ? data.body
      : typeof data.bodyBase64 === "string"
        ? base64ToText(data.bodyBase64)
        : "";
  return {
    path: data.path,
    name: typeof data.name === "string" ? data.name : undefined,
    body,
    bodyBase64: typeof data.bodyBase64 === "string" ? data.bodyBase64 : undefined,
    contentType:
      typeof data.contentType === "string" && data.contentType
        ? data.contentType
        : "application/octet-stream",
    local: data.local === true,
  };
}

function parseWriteFileResult(
  value: unknown,
  fallbackPath: string,
  fallbackContentType: string,
): AppKitsWriteFileResult {
  const data =
    value && typeof value === "object"
      ? (value as Partial<AppKitsWriteFileResult>)
      : {};
  return {
    path: typeof data.path === "string" ? data.path : fallbackPath,
    contentType:
      typeof data.contentType === "string" && data.contentType
        ? data.contentType
        : fallbackContentType,
    local: data.local === true,
  };
}


function parseWorkspaceListResult(value: unknown): AppKitsWorkspaceListResult {
  if (!value || typeof value !== "object") {
    throw new AppKitsBridgeError("invalid_workspace_response", "Missing workspace data.");
  }
  const data = value as Partial<AppKitsWorkspaceListResult>;
  const entries = Array.isArray(data.entries)
    ? data.entries
        .filter((entry: unknown): entry is Record<string, unknown> =>
          Boolean(entry && typeof entry === "object"),
        )
        .map((entry): AppKitsWorkspaceEntry => ({
          path: typeof entry.path === "string" ? entry.path : "",
          name: typeof entry.name === "string" ? entry.name : undefined,
          kind: entry.kind === "directory" ? "directory" : "file",
          contentType: typeof entry.contentType === "string" ? entry.contentType : undefined,
          size: typeof entry.size === "number" ? entry.size : undefined,
          local: entry.local === true,
          temporary: entry.temporary === true,
        }))
        .filter((entry) => entry.path)
    : [];
  return { entries, temporary: data.temporary === true };
}
