# W3Kits VS Code Editor Plugin

This fork adds `w3kits-editor/`, a static browser plugin for W3Kits. It is a single-file editor built on `@codingame/monaco-vscode-api` package family `33.0.9`.

## Scope

- Runtime: `browser-web`, packaged from `w3kits-editor/dist`.
- Launch: installed marketplace app with slug `vscode-editor`.
- File access: only the scoped file supplied by `W3KITS_LAUNCH_PARAMS` or `W3KITS_OPEN_FILE`.
- Bridge calls: `W3KITS_FILE_READ` and `W3KITS_FILE_WRITE`.
- Editor scope: one file at a time through `createModelReference` and a filesystem overlay.

The app does not include the full VS Code workbench, folder explorer, terminal, debugger, extension host, VSIX loading, or workspace search.

## Development

```bash
cd w3kits-editor
npm ci
npm run test
npm run build
```

The build output is written to `w3kits-editor/dist`.

## Packaging

The W3Kits marketplace manifest builds this package with:

```bash
cd w3kits-editor && npm ci && npm run build
```

The marketplace then packs `w3kits-editor/dist` as `r2-files`.
