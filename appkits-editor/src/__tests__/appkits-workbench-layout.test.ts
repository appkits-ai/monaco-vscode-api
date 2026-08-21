import { describe, expect, it } from "vitest";
import {
  APPKITS_DEFAULT_WORKBENCH_VIEWS,
  APPKITS_TERMINAL_STARTUP_CONFIGURATION,
} from "../appkits-workbench-layout";

describe("appkits workbench layout", () => {
  it("does not open Terminal on workbench start", () => {
    expect(APPKITS_DEFAULT_WORKBENCH_VIEWS.map((view) => view.id)).toEqual([
      "workbench.explorer.fileView",
    ]);
    expect(APPKITS_TERMINAL_STARTUP_CONFIGURATION).toEqual({
      "terminal.integrated.enablePersistentSessions": false,
      "terminal.integrated.hideOnStartup": "always",
    });
  });
});
