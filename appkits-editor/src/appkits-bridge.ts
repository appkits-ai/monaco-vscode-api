import {
  createAppKitsClient,
  type AppKitsClient,
  type AppKitsClientOptions,
  type AppKitsFileEntry as SdkFileEntry,
  type AppKitsFileReadResult as SdkFileReadResult,
} from "@appkits-ai/sdk/browser";
import type {
  AppKitsFileEntry,
  AppKitsLaunchParams,
  AppKitsReadFileResult,
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

export interface AppKitsBridgeOptions extends AppKitsClientOptions {
  requestTimeoutMs?: number;
}

export class AppKitsBridge {
  private readonly client: AppKitsClient;

  constructor(
    private readonly hostWindow: Window = window,
    options: AppKitsBridgeOptions = {},
  ) {
    this.client = createAppKitsClient({
      ...options,
      win: options.win ?? hostWindow,
      timeoutMs: options.requestTimeoutMs ?? options.timeoutMs,
    });
  }

  dispose(): void {
    // Requests and subscriptions are owned by @appkits-ai/sdk/browser.
  }

  postReady(): void {
    this.hostWindow.parent.postMessage({ type: "APP_READY" }, "*");
  }

  postWindowTitle(title: string): void {
    void this.client.window.setTitle(title).catch(() => undefined);
  }

  async readFile(path: string): Promise<AppKitsReadFileResult> {
    const data = await this.client.files.read(path);
    return parseReadFileResult(data);
  }

  async readFileBytes(path: string): Promise<Uint8Array> {
    const data = await this.client.files.read(path);
    if (typeof data.bodyBase64 === "string") {
      return Uint8Array.from(atob(data.bodyBase64), (char) => char.charCodeAt(0));
    }
    return new TextEncoder().encode(typeof data.body === "string" ? data.body : "");
  }

  async writeFile(input: {
    path: string;
    body: string;
    contentType: string;
  }): Promise<AppKitsWriteFileResult> {
    const data = await this.client.files.write({
      path: input.path,
      body: input.body,
      contentType: input.contentType,
    });
    return parseWriteFileResult(data, input.path, input.contentType);
  }

  async writeFileBytes(
    path: string,
    content: Uint8Array,
    contentType: string,
  ): Promise<AppKitsWriteFileResult> {
    let binary = "";
    for (const byte of content) binary += String.fromCharCode(byte);
    const data = await this.client.files.write({
      path,
      bodyBase64: btoa(binary),
      contentType,
    });
    return parseWriteFileResult(data, path, contentType);
  }

  async listFiles(path = "/home/agent"): Promise<AppKitsFileEntry[]> {
    const data = await this.client.files.list(path);
    return data.entries.map(normalizeFileEntry);
  }

  async mkdir(path: string): Promise<void> {
    await this.client.files.mkdir(path);
  }

  async deletePath(path: string): Promise<void> {
    await this.client.files.delete(path);
  }

  async renamePath(path: string, toPath: string): Promise<void> {
    await this.client.files.move(path, toPath);
  }

  launchParams(): Promise<AppKitsLaunchParams> {
    return this.client.launch.params() as Promise<AppKitsLaunchParams>;
  }

  onLaunchParams(handler: (params: AppKitsLaunchParams) => void): () => void {
    return this.client.launch.onChange(
      handler as (params: Record<string, unknown>) => void,
    );
  }
}

function normalizeFileEntry(entry: SdkFileEntry): AppKitsFileEntry {
  return {
    path: entry.path,
    name: entry.name,
    kind: entry.kind,
    contentType: entry.contentType,
    size: entry.size,
    updatedAt:
      "updatedAt" in entry && typeof entry.updatedAt === "string"
        ? entry.updatedAt
        : undefined,
    local: entry.local,
    temporary: entry.temporary,
  };
}

function parseReadFileResult(value: unknown): AppKitsReadFileResult {
  if (!value || typeof value !== "object") {
    throw new AppKitsBridgeError("invalid_file_response", "Missing file data.");
  }
  const data = value as Partial<SdkFileReadResult & AppKitsReadFileResult>;
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
