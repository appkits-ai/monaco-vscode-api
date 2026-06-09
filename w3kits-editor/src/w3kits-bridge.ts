import {
  W3KITS_BRIDGE_VERSION,
  W3KITS_FILE_READ,
  W3KITS_FILE_WRITE,
  W3KITS_RESPONSE,
  W3KITS_WINDOW_TITLE,
  type W3KitsBridgeResponse,
  type W3KitsReadFileResult,
  type W3KitsWriteFileResult,
} from "./types";
import { base64ToText, textToBase64 } from "./base64";

export class W3KitsBridgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "W3KitsBridgeError";
    this.code = code;
  }
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

export interface W3KitsBridgeOptions {
  requestTimeoutMs?: number;
  requestIdPrefix?: string;
}

export class W3KitsBridge {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly requestTimeoutMs: number;
  private readonly requestIdPrefix: string;
  private requestIndex = 0;

  constructor(
    private readonly hostWindow: Window = window,
    options: W3KitsBridgeOptions = {},
  ) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15000;
    this.requestIdPrefix = options.requestIdPrefix ?? "w3kits_editor";
    this.hostWindow.addEventListener("message", this.handleMessage);
  }

  dispose(): void {
    this.hostWindow.removeEventListener("message", this.handleMessage);
    for (const [requestId, pending] of this.pending) {
      this.hostWindow.clearTimeout(pending.timeoutId);
      pending.reject(
        new W3KitsBridgeError(
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
      type: W3KITS_WINDOW_TITLE,
      version: W3KITS_BRIDGE_VERSION,
      title,
    });
  }

  async readFile(path: string): Promise<W3KitsReadFileResult> {
    const data = await this.request({
      type: W3KITS_FILE_READ,
      version: W3KITS_BRIDGE_VERSION,
      path,
    });
    return parseReadFileResult(data);
  }

  async writeFile(input: {
    path: string;
    body: string;
    contentType: string;
  }): Promise<W3KitsWriteFileResult> {
    const data = await this.request({
      type: W3KITS_FILE_WRITE,
      version: W3KITS_BRIDGE_VERSION,
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
          new W3KitsBridgeError(
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
      new W3KitsBridgeError(
        response.error?.code || "bridge_error",
        response.error?.message || "W3Kits bridge request failed.",
      ),
    );
  };

  private postToParent(message: Record<string, unknown>): void {
    this.hostWindow.parent.postMessage(message, "*");
  }
}

function parseBridgeResponse(value: unknown): W3KitsBridgeResponse | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<W3KitsBridgeResponse>;
  if (
    candidate.type !== W3KITS_RESPONSE ||
    candidate.version !== W3KITS_BRIDGE_VERSION ||
    typeof candidate.requestId !== "string" ||
    typeof candidate.ok !== "boolean"
  ) {
    return null;
  }
  return candidate as W3KitsBridgeResponse;
}

function parseReadFileResult(value: unknown): W3KitsReadFileResult {
  if (!value || typeof value !== "object") {
    throw new W3KitsBridgeError("invalid_file_response", "Missing file data.");
  }
  const data = value as Partial<W3KitsReadFileResult>;
  if (typeof data.path !== "string") {
    throw new W3KitsBridgeError("invalid_file_response", "Missing file path.");
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
): W3KitsWriteFileResult {
  const data =
    value && typeof value === "object"
      ? (value as Partial<W3KitsWriteFileResult>)
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
