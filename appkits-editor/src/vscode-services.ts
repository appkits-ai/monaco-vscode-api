/**
 * 初始化精简 VS Code 服务覆盖，并复用同一套 Monaco worker。
 * Initializes the thin VS Code service overrides and reuses the same Monaco workers.
 *
 * @owner appkits-editor
 * @module vscode-editor
 */
import { installMonacoEnvironment } from "./monaco-environment";

export type IEditorOverrideServices = Record<string, unknown>;

type InitializeFn = (services: IEditorOverrideServices) => Promise<void>;

export interface InitializeVscodeEditorServicesOptions {
  initialize?: InitializeFn;
  installWorkers?: () => void;
  installDefaultExtensions?: () => Promise<void>;
  serviceOverrides?: () => IEditorOverrideServices | Promise<IEditorOverrideServices>;
}

let servicesPromise: Promise<void> | null = null;

/**
 * 测试用：清空已初始化的 VS Code 服务单例。
 * Test helper that clears the initialized VS Code service singleton.
 */
export function resetVscodeEditorServicesForTests(): void {
  servicesPromise = null;
}

/**
 * 安装 worker 后初始化 VS Code 覆盖服务。
 * Installs workers, then initializes VS Code override services.
 */
export function initializeVscodeEditorServices(
  options: InitializeVscodeEditorServicesOptions = {},
): Promise<void> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      options.installWorkers?.();
      if (!options.installWorkers) installMonacoEnvironment();
      await (options.installDefaultExtensions ?? loadAppKitsDefaultExtensions)();
      await (options.initialize ?? defaultInitialize)(
        await (options.serviceOverrides ?? buildAppKitsServiceOverrides)(),
      );
    })();
  }
  return servicesPromise;
}

async function loadAppKitsDefaultExtensions(): Promise<void> {
  await Promise.all([
    import("@codingame/monaco-vscode-theme-defaults-default-extension"),
    import("@codingame/monaco-vscode-javascript-default-extension"),
    import("@codingame/monaco-vscode-typescript-basics-default-extension"),
    import("@codingame/monaco-vscode-json-default-extension"),
    import("@codingame/monaco-vscode-css-default-extension"),
    import("@codingame/monaco-vscode-html-default-extension"),
    import("@codingame/monaco-vscode-markdown-basics-default-extension"),
    import("@codingame/monaco-vscode-yaml-default-extension"),
  ]);
}

async function defaultInitialize(services: IEditorOverrideServices): Promise<void> {
  const { initialize } = await import("@codingame/monaco-vscode-api");
  await initialize(services);
}

export async function buildAppKitsServiceOverrides(): Promise<IEditorOverrideServices> {
  const [
    base,
    host,
    environment,
    extensions,
    configuration,
    theme,
    textmate,
    languages,
    files,
    model,
    layout,
    quickaccess,
  ] = await Promise.all([
    import("@codingame/monaco-vscode-base-service-override"),
    import("@codingame/monaco-vscode-host-service-override"),
    import("@codingame/monaco-vscode-environment-service-override"),
    import("@codingame/monaco-vscode-extensions-service-override"),
    import("@codingame/monaco-vscode-configuration-service-override"),
    import("@codingame/monaco-vscode-theme-service-override"),
    import("@codingame/monaco-vscode-textmate-service-override"),
    import("@codingame/monaco-vscode-languages-service-override"),
    import("@codingame/monaco-vscode-files-service-override"),
    import("@codingame/monaco-vscode-model-service-override"),
    import("@codingame/monaco-vscode-layout-service-override"),
    import("@codingame/monaco-vscode-quickaccess-service-override"),
  ]);
  return {
    ...base.default(),
    ...host.default(),
    ...environment.default(),
    ...extensions.default(),
    ...configuration.default(),
    ...theme.default(),
    ...textmate.default(),
    ...languages.default(),
    ...files.default(),
    ...model.default(),
    ...layout.default(),
    ...quickaccess.default(),
  };
}
