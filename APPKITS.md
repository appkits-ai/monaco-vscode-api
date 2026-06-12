# AppKits Fork Notes

This repository is the AppKits fork of `codingame/monaco-vscode-api`.

- `main` tracks upstream and should stay free of AppKits integration changes.
- `appkits-dev` carries AppKits-specific work.
- The AppKits plugin lives in `appkits-editor/`.
- The marketplace packages `appkits-editor/dist` as the `vscode-editor`
  browser-web plugin after running `cd appkits-editor && npm ci && npm run build`.

See `appkits-editor/APPKITS.md` for the plugin scope, bridge calls, development
commands, and packaging details.
