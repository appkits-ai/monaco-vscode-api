/**
 * 默认只打开 Explorer；Terminal 由用户手势再启动 isolate Bash。
 * Default workbench opens Explorer only; Terminal starts isolate Bash on a
 * user gesture instead of workbench boot.
 *
 * @owner appkits-editor
 * @module vscode-editor
 */

export const APPKITS_DEFAULT_WORKBENCH_VIEWS = [
  { id: "workbench.explorer.fileView" },
] as const;

/**
 * 禁止恢复上次 Terminal 会话，避免硬刷新/重挂时 createProcess → runtime.ensure。
 * Disables persisted Terminal sessions so remount does not createProcess and
 * runtime.ensure bash.
 */
export const APPKITS_TERMINAL_STARTUP_CONFIGURATION = {
  "terminal.integrated.enablePersistentSessions": false,
  "terminal.integrated.hideOnStartup": "always",
} as const;
