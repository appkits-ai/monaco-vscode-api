# AppKits VS Code Editor Plugin

This fork adds `appkits-editor/`, a static browser plugin for AppKits. It is a single-file editor built on `@codingame/monaco-vscode-api` package family `33.0.9`.

## Scope

- Runtime: `browser-web`, packaged from `appkits-editor/dist`.
- Launch: installed marketplace app with slug `vscode-editor`.
- File access: only the scoped file supplied by `APPKITS_LAUNCH_PARAMS` or `APPKITS_OPEN_FILE`.
- Bridge calls: `APPKITS_FILE_READ` and `APPKITS_FILE_WRITE`.
- Editor scope: one file at a time through `createModelReference` and a filesystem overlay.

The app does not include the full VS Code workbench, folder explorer, terminal, debugger, extension host, VSIX loading, or workspace search.

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
