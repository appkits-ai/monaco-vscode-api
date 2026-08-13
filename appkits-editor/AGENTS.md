# AGENTS.md — AppKits VS Code Editor plugin

This directory is the AppKits plugin (`@appkits-ai/vscode-editor`) inside the `appkits-ai/monaco-vscode-api` fork. Do not apply AppKits or BlockReq harness rules to the upstream monaco-vscode-api tree outside `appkits-editor/`.

## Workspace AppKits

This checkout is a member of **Workspace AppKits**. Host path: `/home/agent/workspace/appkits/<repo>`. Do not load BlockReq or other workspace rules. `project-harness-skill` is the shared contract factory, not a member.

| Member | Role | Default base |
| --- | --- | --- |
| `appkits-ai/core` | SDK, UI, shared eslint, desktop/host product contracts | `main` |
| `appkits-ai/file-explorer` | File manager plugin `@appkits-ai/plugin-file-explorer` | `main` |
| `appkits-ai/monaco-vscode-api` | Upstream monaco-vscode-api fork; AppKits plugin lives only under `appkits-editor/` as `@appkits-ai/vscode-editor` | `main` |

Route work to the owning member before loading that member's overlay. One GitHub Issue covers this workspace only. Open that Issue in the owning member before the first PR. A pull request is not a substitute. Dominant PR: `Fixes #N` / `Closes #N`. Sibling PRs: `Refs owner/repo#N`. Typical order: SDK contract changes land in `appkits-ai/core` first; plugin members bump `CORE_REF` / SDK only after that core change is merged and the SHA is pinnable. Plugin-only UI may ship as a single-member PR.

### Freshness gate

Before durable edits, fetch each member's `origin/<base>` and inspect open PRs. Process existing open PRs: merge if complete, close if already done, stale, or superseded, rebase if behind; then open the new PR. An unmerged PR for this workstream may only receive CI fixes or review replies. After this repository's PR is open, stop and wait for review or merge. Run `bash scripts/agent-issue-gate.sh` when the script exists.

## This plugin

- Load `.agents/skills/virgin-principle/SKILL.md` for every durable change, then `.agents/skills/issue-delivery/SKILL.md` for linking rules.
- File access stays on `/home/agent` through `@appkits-ai/sdk/client` `FileSystem.*`. Do not invent a private filesystem protocol.
- Upstream Issues on this fork are closed. Open the living Issue on `appkits-ai/core` or `appkits-ai/file-explorer` and link this repository's PR with `Refs owner/repo#N`.
- Keep governance files under `appkits-editor/`. Do not add a root `AGENTS.md`, SpecKit tree, or BlockReq overlay to the upstream fork.
- Product notes live in `APPKITS.md`.

```bash
bash appkits-editor/scripts/agent-issue-gate.sh
cd appkits-editor
npm ci
npm run test
npm run build
git diff --check
```
