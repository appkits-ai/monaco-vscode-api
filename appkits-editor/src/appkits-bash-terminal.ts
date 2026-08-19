/**
 * 把 isolate Bash 接到 monaco-vscode Terminal 后端。
 * Wires isolate Bash into the monaco-vscode Terminal backend.
 */
import {
  SimpleTerminalBackend,
  SimpleTerminalProcess,
  type ITerminalChildProcess,
} from "@codingame/monaco-vscode-terminal-service-override";
import {
  AppKitsBashTerminalOverlay,
  type BashRuntimeEnsure,
  startBashTerminalSession,
} from "./appkits-bash-terminal-session";
import {
  ensurePluginRuntime,
  type RuntimeEnsureSuccess,
} from "./appkits-runtime-ensure";

export {
  AppKitsBashTerminalOverlay,
  BASH_PLUGIN_SLUG,
  BASH_TERMINAL_OVERLAY_ID,
  startBashTerminalSession,
} from "./appkits-bash-terminal-session";

/** VS Code terminal backend that loads the required isolate Bash plugin. */
export class AppKitsTerminalBackend extends SimpleTerminalBackend {
  private session: Promise<RuntimeEnsureSuccess> | null = null;
  private nextId = 1;
  private readonly ensure: BashRuntimeEnsure;
  private readonly overlay: AppKitsBashTerminalOverlay;

  constructor(
    options: {
      ensure?: BashRuntimeEnsure;
      overlay?: AppKitsBashTerminalOverlay;
    } = {},
  ) {
    super();
    this.ensure = options.ensure ?? ((input) => ensurePluginRuntime(input));
    this.overlay = options.overlay ?? new AppKitsBashTerminalOverlay();
    this.setReady();
  }

  override getDefaultSystemShell = async (): Promise<string> => "/bin/bash";

  override createProcess = async (): Promise<ITerminalChildProcess> => {
    const listeners = new Set<(data: string) => void>();
    const write = (data: string) => {
      for (const listener of listeners) listener(data);
    };
    return new AppKitsBashTerminalProcess({
      id: this.nextId++,
      cwd: "/home/agent",
      onData: (listener) => {
        listeners.add(listener);
        return { dispose: () => listeners.delete(listener) };
      },
      startSession: () =>
        startBashTerminalSession({
          write,
          ensure: this.ensureOnce,
          overlay: this.overlay,
        }),
    });
  };

  private readonly ensureOnce: BashRuntimeEnsure = (input) => {
    if (!this.session) {
      this.session = this.ensure(input).catch((error) => {
        this.session = null;
        throw error;
      });
    }
    return this.session;
  };
}

class AppKitsBashTerminalProcess extends SimpleTerminalProcess {
  constructor(
    private readonly options: {
      id: number;
      cwd: string;
      onData: (listener: (data: string) => void) => { dispose(): void };
      startSession: () => Promise<void>;
    },
  ) {
    super(options.id, options.id, options.cwd, options.onData);
  }

  async start(): Promise<undefined> {
    await this.options.startSession();
    return undefined;
  }

  override shutdown(): void {}

  override input(): void {}

  override resize(): void {}

  override clearBuffer(): void {}

  override sendSignal(): void {}
}
