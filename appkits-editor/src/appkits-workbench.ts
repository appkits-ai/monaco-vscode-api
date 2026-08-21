/**
 * 启动 AppKits VS Code workbench；Explorer 默认打开，isolate Bash 仅在用户打开 Terminal 时启动。
 * Starts the AppKits VS Code workbench. Explorer is default; isolate Bash
 * starts only when the user opens the Terminal panel.
 */
import "./monaco-environment";
import * as appkits from "@appkits-ai/sdk/client";
import * as monaco from "monaco-editor";
import {
  IEditorService,
  LogLevel,
  getService,
  initialize,
  type IEditorOverrideServices,
  type IWorkbenchConstructionOptions,
} from "@codingame/monaco-vscode-api";
import { registerExtension } from "@codingame/monaco-vscode-api/extensions";
import { ExtensionHostKind } from "@codingame/monaco-vscode-extensions-service-override";
import getWorkbenchServiceOverride from "@codingame/monaco-vscode-workbench-service-override";
import getQuickAccessServiceOverride from "@codingame/monaco-vscode-quickaccess-service-override";
import getBaseServiceOverride from "@codingame/monaco-vscode-base-service-override";
import getHostServiceOverride from "@codingame/monaco-vscode-host-service-override";
import getEnvironmentServiceOverride from "@codingame/monaco-vscode-environment-service-override";
import getExtensionServiceOverride from "@codingame/monaco-vscode-extensions-service-override";
import getConfigurationServiceOverride, {
  initUserConfiguration,
} from "@codingame/monaco-vscode-configuration-service-override";
import getKeybindingsServiceOverride, {
  initUserKeybindings,
} from "@codingame/monaco-vscode-keybindings-service-override";
import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
import getTextmateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
import getFilesServiceOverride, {
  registerFileSystemOverlay,
} from "@codingame/monaco-vscode-files-service-override";
import getModelServiceOverride from "@codingame/monaco-vscode-model-service-override";
import getLayoutServiceOverride from "@codingame/monaco-vscode-layout-service-override";
import getStorageServiceOverride from "@codingame/monaco-vscode-storage-service-override";
import getLifecycleServiceOverride from "@codingame/monaco-vscode-lifecycle-service-override";
import getWorkingCopyServiceOverride from "@codingame/monaco-vscode-working-copy-service-override";
import getExplorerServiceOverride from "@codingame/monaco-vscode-explorer-service-override";
import getNotificationServiceOverride from "@codingame/monaco-vscode-notifications-service-override";
import getDialogsServiceOverride from "@codingame/monaco-vscode-dialogs-service-override";
import getTerminalServiceOverride from "@codingame/monaco-vscode-terminal-service-override";
import { AppKitsTerminalBackend } from "./appkits-bash-terminal";
import "vscode/localExtensionHost";
import "@codingame/monaco-vscode-theme-defaults-default-extension";
import "@codingame/monaco-vscode-javascript-default-extension";
import "@codingame/monaco-vscode-typescript-basics-default-extension";
import "@codingame/monaco-vscode-json-default-extension";
import "@codingame/monaco-vscode-css-default-extension";
import "@codingame/monaco-vscode-html-default-extension";
import "@codingame/monaco-vscode-markdown-basics-default-extension";
import "@codingame/monaco-vscode-yaml-default-extension";
import {
  APPKITS_WORKSPACE_FILE,
  APPKITS_WORKSPACE_ROOT,
  AppKitsFileSystemProvider,
} from "./appkits-file-system-provider";
import { installMonacoEnvironment } from "./monaco-environment";
import {
  APPKITS_DEFAULT_WORKBENCH_VIEWS,
  APPKITS_TERMINAL_STARTUP_CONFIGURATION,
} from "./appkits-workbench-layout";
import { openFileFromHostMessage, openFileFromLaunchParams } from "./launch-params";
import type { AppKitsOpenFile } from "./types";

/**
 * 初始化 workbench、VFS 与启动参数打开；不在启动时打开 Terminal。
 * Initializes the workbench, VFS, and launch-file open; does not open Terminal on boot.
 */
export async function startAppKitsWorkbench(container: HTMLElement): Promise<void> {
  installMonacoEnvironment();
  await initUserConfiguration(
    JSON.stringify({
      "workbench.colorTheme": "Default Dark Modern",
      "workbench.startupEditor": "none",
      "explorer.confirmDelete": false,
      "explorer.confirmDragAndDrop": false,
      "files.simpleDialog.enable": true,
      "window.commandCenter": false,
      "workbench.activity.showAccounts": false,
      "workbench.activity.showGlobalActions": false,
      ...APPKITS_TERMINAL_STARTUP_CONFIGURATION,
    }),
  );
  await initUserKeybindings("[]");

  registerFileSystemOverlay(10, new AppKitsFileSystemProvider());

  await initialize(buildServices(), container, constructionOptions(), {
    userHome: monaco.Uri.file(APPKITS_WORKSPACE_ROOT),
  });

  await registerExtension(
    {
      name: "appkits-workbench",
      publisher: "appkits-ai",
      version: "1.0.0",
      engines: { vscode: "*" },
    },
    ExtensionHostKind.LocalProcess,
  ).setAsDefaultApi();

  window.addEventListener("message", (event) => {
    const file = openFileFromHostMessage(event.data);
    if (file) void openAppKitsFile(file);
  });

  const launchParams = await appkits.Launch.params().catch(() => ({}));
  const launchFile = openFileFromLaunchParams(launchParams);
  if (launchFile) await openAppKitsFile(launchFile);
  appkits.Launch.onChange((params) => {
    const file = openFileFromLaunchParams(params);
    if (file) void openAppKitsFile(file);
  });

  appkits.Window.setTitle("VS Code Editor").catch(() => undefined);
}

/**
 * 组装 workbench 服务覆盖，包括 isolate Bash Terminal 后端。
 * Assembles workbench service overrides, including the isolate Bash Terminal backend.
 */
function buildServices(): IEditorOverrideServices {
  return {
    ...getBaseServiceOverride(),
    ...getHostServiceOverride(),
    ...getEnvironmentServiceOverride(),
    ...getExtensionServiceOverride({ enableWorkerExtensionHost: true }),
    ...getConfigurationServiceOverride(),
    ...getKeybindingsServiceOverride(),
    ...getThemeServiceOverride(),
    ...getTextmateServiceOverride(),
    ...getLanguagesServiceOverride(),
    ...getFilesServiceOverride(),
    ...getModelServiceOverride(),
    ...getLayoutServiceOverride(),
    ...getWorkbenchServiceOverride(),
    ...getQuickAccessServiceOverride({
      isKeybindingConfigurationVisible: () => true,
      shouldUseGlobalPicker: () => true,
    }),
    ...getNotificationServiceOverride(),
    ...getDialogsServiceOverride(),
    ...getStorageServiceOverride({
      fallbackOverride: {
        "workbench.activity.showAccounts": false,
      },
    }),
    ...getLifecycleServiceOverride(),
    ...getWorkingCopyServiceOverride(),
    ...getExplorerServiceOverride(),
    ...getTerminalServiceOverride(new AppKitsTerminalBackend()),
  };
}

/**
 * 配置可信工作区、默认 Explorer 与 Terminal 面板。
 * Configures the trusted workspace and the default Explorer plus Terminal panels.
 */
function constructionOptions(): IWorkbenchConstructionOptions {
  return {
    workspaceProvider: {
      trusted: true,
      async open() {
        return true;
      },
      workspace: {
        workspaceUri: monaco.Uri.file(APPKITS_WORKSPACE_FILE),
      },
    },
    developmentOptions: { logLevel: LogLevel.Info },
    windowIndicator: {
      label: "AppKits",
      tooltip: "AppKits Core VFS",
      command: "",
    },
    configurationDefaults: {
      "window.title": "${activeEditorShort}${separator}AppKits",
    },
    defaultLayout: {
      views: [...APPKITS_DEFAULT_WORKBENCH_VIEWS],
      force: false,
    },
    productConfiguration: {
      nameShort: "AppKits VS Code",
      nameLong: "AppKits VS Code Editor",
      applicationName: "appkits-vscode-editor",
      dataFolderName: ".appkits-vscode-editor",
      version: "0.1.9",
    },
  };
}

async function openAppKitsFile(file: AppKitsOpenFile): Promise<void> {
  const uri = monaco.Uri.file(file.path);
  const editorService = await getService(IEditorService);
  await editorService.openEditor({ resource: uri, options: { pinned: true } });
  await appkits.Window.setTitle(file.name || basename(file.path)).catch(() => undefined);
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).at(-1) || path;
}
