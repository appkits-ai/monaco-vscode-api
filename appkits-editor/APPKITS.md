# AppKits VS Code Editor Plugin

This fork keeps `main` aligned with `codingame/monaco-vscode-api`. AppKits changes live on the `appkits-dev` branch under `appkits-editor/`, a static browser plugin for AppKits built on `@codingame/monaco-vscode-api` package family `33.0.9`.

## Scope

- Runtime: `browser-web`, packaged from `appkits-editor/dist`.
- Launch: installed marketplace app with slug `vscode-editor`.
- File access: only the scoped file supplied through the AppKits SDK launch params.
- Bridge calls: `@appkits-ai/sdk/browser` `launch.params`, `launch.change`, `files.read`, `files.write`, and `window.setTitle`.
- Editor scope: one file at a time through `createModelReference` and a filesystem overlay.

The app does not include the full VS Code workbench, folder explorer, terminal, debugger, extension host, VSIX loading, or workspace search.

Do not commit AppKits integration directly to `main`; rebase or merge upstream there, then carry AppKits-specific work on `appkits-dev`.

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
