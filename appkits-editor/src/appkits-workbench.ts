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
  APPKITS_WORKSPACE_ROOT,
  AppKitsFileSystemProvider,
} from "./appkits-file-system-provider";
import { APPKITS_WORKSPACE_FILE, normalizeAppKitsPath } from "./appkits-paths";
import { openFileFromHostMessage, openFileFromLaunchParams } from "./launch-params";
import type { AppKitsOpenFile } from "./types";

export async function startAppKitsWorkbench(container: HTMLElement): Promise<void> {
  installWorkers();
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
  };
}

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
      views: [{ id: "workbench.explorer.fileView" }],
      force: false,
    },
    productConfiguration: {
      nameShort: "AppKits VS Code",
      nameLong: "AppKits VS Code Editor",
      applicationName: "appkits-vscode-editor",
      dataFolderName: ".appkits-vscode-editor",
      version: "0.1.11",
    },
  };
}

async function openAppKitsFile(file: AppKitsOpenFile): Promise<void> {
  const uri = monaco.Uri.file(normalizeAppKitsPath(file.path));
  const editorService = await getService(IEditorService);
  await editorService.openEditor({ resource: uri, options: { pinned: true } });
  await appkits.Window.setTitle(file.name || basename(file.path)).catch(() => undefined);
}

function installWorkers(): void {
  window.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      if (label === "TextMateWorker") {
        return new Worker(
          new URL("@codingame/monaco-vscode-textmate-service-override/worker", import.meta.url),
          { type: "module" },
        );
      }
      if (label === "extensionHostWorkerMain") {
        return new Worker(
          new URL("@codingame/monaco-vscode-api/workers/extensionHost.worker", import.meta.url),
          { type: "module" },
        );
      }
      return new Worker(
        new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url),
        { type: "module" },
      );
    },
  };
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).at(-1) || path;
}
