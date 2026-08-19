/**
 * 向宿主请求 isolate 运行时会话，不经过未发布的 SDK 方法联合。
 * Requests an isolate runtime session from the host without the unpublished SDK method union.
 */

export const APPKITS_DESKTOP_REQUEST = "APPKITS_DESKTOP_REQUEST";
export const APPKITS_RESPONSE = "APPKITS_RESPONSE";
export const APPKITS_CLIENT_BRIDGE_VERSION = 1;
export const RUNTIME_ENSURE_METHOD = "runtime.ensure";
/** Container cold-start budget for one runtime.ensure probe. */
export const RUNTIME_ENSURE_TIMEOUT_MS = 90_000;

/** Failed host runtime.ensure request with a stable bridge error code. */
export class AppKitsRuntimeEnsureError extends Error {
  readonly code: string;
  readonly requestId?: string;

  constructor(code: string, message: string, requestId?: string) {
    super(message);
    this.name = "AppKitsRuntimeEnsureError";
    this.code = code;
    this.requestId = requestId;
  }
}

/** Admitted isolate session returned by the desktop host. */
export type RuntimeEnsureSuccess = {
  originUrl: string;
  startUrl: string;
};

type RuntimeEnsureWindow = {
  parent?: {
    postMessage: (message: unknown, targetOrigin: string) => void;
  } | null;
  addEventListener?: (type: "message", listener: (event: Event) => void) => void;
  removeEventListener?: (
    type: "message",
    listener: (event: Event) => void,
  ) => void;
};

/**
 * 构造 runtime.ensure 的宿主请求信封。
 * Builds the host request envelope for runtime.ensure.
 */
export function createRuntimeEnsureRequest(input: {
  requestId: string;
  pluginSlug: string;
}): {
  type: typeof APPKITS_DESKTOP_REQUEST;
  version: typeof APPKITS_CLIENT_BRIDGE_VERSION;
  requestId: string;
  method: typeof RUNTIME_ENSURE_METHOD;
  params: { pluginSlug: string };
} {
  return {
    type: APPKITS_DESKTOP_REQUEST,
    version: APPKITS_CLIENT_BRIDGE_VERSION,
    requestId: input.requestId,
    method: RUNTIME_ENSURE_METHOD,
    params: { pluginSlug: input.pluginSlug },
  };
}

/**
 * 校验宿主返回的 isolate 源地址。
 * Validates the isolate origin returned by the host.
 */
export function parseRuntimeEnsureResult(value: unknown): RuntimeEnsureSuccess {
  if (!value || typeof value !== "object") {
    throw new AppKitsRuntimeEnsureError(
      "invalid_runtime",
      "Missing runtime session.",
    );
  }
  const data = value as Record<string, unknown>;
  const originUrl =
    typeof data.originUrl === "string" ? data.originUrl.trim() : "";
  const startUrl =
    typeof data.startUrl === "string" ? data.startUrl.trim() : "";
  if (!originUrl) {
    throw new AppKitsRuntimeEnsureError(
      "invalid_runtime",
      "Missing isolate origin URL.",
    );
  }
  return { originUrl, startUrl };
}

/**
 * 向桌面宿主发送 runtime.ensure 并等待准入 isolate 文档。
 * Sends runtime.ensure to the desktop host and waits for the admitted isolate document.
 */
export async function ensurePluginRuntime(input: {
  pluginSlug: string;
  timeoutMs?: number;
  win?: RuntimeEnsureWindow;
  createRequestId?: () => string;
}): Promise<RuntimeEnsureSuccess> {
  const pluginSlug = input.pluginSlug.trim();
  if (!pluginSlug) {
    throw new AppKitsRuntimeEnsureError(
      "invalid_plugin",
      "Plugin slug is required.",
    );
  }

  const win = input.win ?? globalThis.window;
  const parent = win?.parent;
  const addMessageListener = win?.addEventListener?.bind(win);
  const removeMessageListener = win?.removeEventListener?.bind(win);
  if (!parent || parent === win || !addMessageListener || !removeMessageListener) {
    throw new AppKitsRuntimeEnsureError(
      "not_inside_appkits",
      "AppKits desktop SDK is only available inside a AppKits iframe.",
    );
  }

  const requestId = (input.createRequestId ?? createRequestId)();
  const timeoutMs = input.timeoutMs ?? RUNTIME_ENSURE_TIMEOUT_MS;
  const envelope = createRuntimeEnsureRequest({ requestId, pluginSlug });

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      removeMessageListener("message", handleMessage);
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const handleMessage = (event: Event) => {
      const message = "data" in event ? event.data : undefined;
      if (!isRuntimeEnsureResponse(message) || message.requestId !== requestId) {
        return;
      }
      settle(() => {
        if (message.ok) {
          try {
            resolve(parseRuntimeEnsureResult(message.data));
          } catch (error) {
            reject(error);
          }
          return;
        }
        reject(
          new AppKitsRuntimeEnsureError(
            message.error?.code || "request_failed",
            message.error?.message || "AppKits desktop request failed.",
            requestId,
          ),
        );
      });
    };

    addMessageListener("message", handleMessage);
    timer = setTimeout(() => {
      settle(() =>
        reject(
          new AppKitsRuntimeEnsureError(
            "request_timeout",
            `AppKits desktop request timed out after ${timeoutMs}ms.`,
            requestId,
          ),
        ),
      );
    }, timeoutMs);
    parent.postMessage(envelope, "*");
  });
}

function createRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `appkits_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function isRuntimeEnsureResponse(value: unknown): value is {
  type: typeof APPKITS_RESPONSE;
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message?: string };
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { type?: unknown }).type === APPKITS_RESPONSE &&
      typeof (value as { requestId?: unknown }).requestId === "string" &&
      typeof (value as { ok?: unknown }).ok === "boolean",
  );
}
