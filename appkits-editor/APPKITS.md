# AppKits VS Code Editor Plugin

This fork adds `appkits-editor/`, a static browser plugin for AppKits. It runs the `@codingame/monaco-vscode-api` workbench package family `33.0.9` and connects the VS Code file service to the AppKits Core SDK filesystem.

## Scope

- Runtime: `browser-web`, packaged from `appkits-editor/dist`.
- Launch: installed marketplace app with slug `vscode-editor`.
- File access: `/home/agent` workspace through `@appkits-ai/sdk/client` `FileSystem.*`.
- Workspace presentation: Explorer and editor breadcrumbs show `home > agent`; `/home` is a local virtual parent whose only child is `agent`, never an SDK or durable authority.
- Authority: `userHome`, launch targets, reads, writes, moves, deletes, and all other SDK operations remain rooted at canonical `/home/agent/**` paths.
- Launch: `@appkits-ai/sdk/client` `Launch.params()` / `Launch.onChange()` read `appkitsOpenFile` and open the target file in the workbench editor.
- Editor scope: upstream VS Code workbench shell with Explorer, tabs, editor groups, status UI, and the AppKits VFS provider.

The app does not provide a native terminal or unrestricted host filesystem. All file operations remain scoped to the AppKits Core SDK VFS contract.

## Development

```bash
cd appkits-editor
npm ci
npm run test
npm run build
```

The build output is written to `appkits-editor/dist`.

## Packaging

The AppKits marketplace manifest builds this package with:

```bash
cd appkits-editor && npm ci && npm run build
```

The marketplace then packs `appkits-editor/dist` as `r2-files`.
