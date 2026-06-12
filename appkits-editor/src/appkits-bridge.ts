import {
  APPKITS_BRIDGE_VERSION,
  APPKITS_DESKTOP_FS_LIST,
  APPKITS_FILE_READ,
  APPKITS_FILE_WRITE,
  APPKITS_RESPONSE,
  APPKITS_WINDOW_TITLE,
  type AppKitsBridgeResponse,
  type AppKitsReadFileResult,
  type AppKitsWorkspaceEntry,
  type AppKitsWorkspaceListResult,
  type AppKitsWriteFileResult,
} from "./types";
import { base64ToText, textToBase64 } from "./base64";

export class AppKitsBridgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppKitsBridgeError";
    this.code = code;
  }
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

export interface AppKitsBridgeOptions {
  requestTimeoutMs?: number;
  requestIdPrefix?: string;
}

export class AppKitsBridge {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly requestTimeoutMs: number;
  private readonly requestIdPrefix: string;
  private requestIndex = 0;

  constructor(
    private readonly hostWindow: Window = window,
    options: AppKitsBridgeOptions = {},
  ) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15000;
    this.requestIdPrefix = options.requestIdPrefix ?? "appkits_editor";
    this.hostWindow.addEventListener("message", this.handleMessage);
  }

  dispose(): void {
    this.hostWindow.removeEventListener("message", this.handleMessage);
    for (const [requestId, pending] of this.pending) {
      this.hostWindow.clearTimeout(pending.timeoutId);
      pending.reject(
        new AppKitsBridgeError(
          "bridge_disposed",
          `Bridge disposed before ${requestId} completed.`,
        ),
      );
    }
    this.pending.clear();
  }

  postReady(): void {
    this.postToParent({ type: "APP_READY" });
  }

  postWindowTitle(title: string): void {
    this.postToParent({
      type: APPKITS_WINDOW_TITLE,
      version: APPKITS_BRIDGE_VERSION,
      title,
    });
  }

  async readFile(path: string): Promise<AppKitsReadFileResult> {
    const data = await this.request({
      type: APPKITS_FILE_READ,
      version: APPKITS_BRIDGE_VERSION,
      path,
    });
    return parseReadFileResult(data);
  }

  async listWorkspaceFiles(): Promise<AppKitsWorkspaceListResult> {
    const data = await this.request({
      type: APPKITS_DESKTOP_FS_LIST,
      version: APPKITS_BRIDGE_VERSION,
      path: "/home/agent",
    });
    return parseWorkspaceListResult(data);
  }

  async writeFile(input: {
    path: string;
    body: string;
    contentType: string;
  }): Promise<AppKitsWriteFileResult> {
    const data = await this.request({
      type: APPKITS_FILE_WRITE,
      version: APPKITS_BRIDGE_VERSION,
      path: input.path,
      body: input.body,
      bodyBase64: textToBase64(input.body),
      contentType: input.contentType,
    });
    return parseWriteFileResult(data, input.path, input.contentType);
  }

  private request(message: Record<string, unknown>): Promise<unknown> {
    const requestId = `${this.requestIdPrefix}_${Date.now()}_${++this.requestIndex}`;
    const payload = { ...message, requestId };
    return new Promise((resolve, reject) => {
      const timeoutId = this.hostWindow.setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new AppKitsBridgeError(
            "bridge_timeout",
            `Timed out waiting for ${String(message.type)} response.`,
          ),
        );
      }, this.requestTimeoutMs);
      this.pending.set(requestId, { resolve, reject, timeoutId });
      this.postToParent(payload);
    });
  }

  private readonly handleMessage = (event: MessageEvent): void => {
    const response = parseBridgeResponse(event.data);
    if (!response) return;
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    this.pending.delete(response.requestId);
    this.hostWindow.clearTimeout(pending.timeoutId);
    if (response.ok) {
      pending.resolve(response.data);
      return;
    }
    pending.reject(
      new AppKitsBridgeError(
        response.error?.code || "bridge_error",
        response.error?.message || "AppKits bridge request failed.",
      ),
    );
  };

  private postToParent(message: Record<string, unknown>): void {
    this.hostWindow.parent.postMessage(message, "*");
  }
}

function parseBridgeResponse(value: unknown): AppKitsBridgeResponse | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AppKitsBridgeResponse>;
  if (
    candidate.type !== APPKITS_RESPONSE ||
    candidate.version !== APPKITS_BRIDGE_VERSION ||
    typeof candidate.requestId !== "string" ||
    typeof candidate.ok !== "boolean"
  ) {
    return null;
  }
  return candidate as AppKitsBridgeResponse;
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
