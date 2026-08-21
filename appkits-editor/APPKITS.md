<!--
把 AppKits VS Code 插件的范围、开发命令和 worker 打包合同写清楚。
Records the AppKits VS Code plugin scope, development commands, and worker bundle contract.
-->
# AppKits VS Code Editor Plugin

Agent entry for this plugin is `AGENTS.md`. This fork adds `appkits-editor/`, a static browser plugin for AppKits. It runs the `@codingame/monaco-vscode-api` workbench package family `33.0.9` and connects the VS Code file service to the AppKits Core SDK filesystem.

## Scope

- Runtime: `browser-web`, packaged from `appkits-editor/dist`.
- Launch: installed marketplace app with slug `vscode-editor`.
- File access: `/home/agent` workspace through `@appkits-ai/sdk/client` `FileSystem.*`.
- Launch: `appkitsOpenFile` and host open-file messages open the target file in the workbench editor.
- Editor scope: upstream VS Code workbench shell with Explorer, tabs, editor groups, status UI, and the AppKits VFS provider.
- Terminal: opening the workbench Terminal panel starts the required isolate Bash plugin through host `runtime.ensure({ pluginSlug: "bash" })` and overlays the admitted ttyd document. Workbench start does not open Terminal or call `runtime.ensure`. It does not fake a local shell or speak ttyd's WebSocket.

File operations remain scoped to the AppKits Core SDK VFS contract. The isolate Bash home is container-local; Computer/DOFS stays Home/Workspace authority.

## Development

```bash
cd appkits-editor
npm ci
npm run test
npm run build
```

The build output is written to `appkits-editor/dist`.

Claimed Monaco workers (`extensionHostWorkerMain`, `TextMateWorker`, `editorWorkerService`) must be Vite `?worker&url` ESM chunks. `new URL(packageEntry, import.meta.url)` inlines the unbundled stub as a `data:` URL; the worker then fails to resolve `../vscode/src/vs/workbench/api/worker/extensionHostWorkerMain.js` and LocalWebWorker exits 81. `npm run build` rejects those stubs.

## Packaging

The AppKits marketplace manifest builds this package with:

```bash
cd appkits-editor && npm ci && npm run build
```

The marketplace then packs `appkits-editor/dist` as `r2-files`.
