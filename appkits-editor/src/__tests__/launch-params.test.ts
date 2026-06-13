import { describe, expect, it } from "vitest";
import { openFileFromLaunchParams } from "../launch-params";

const openFile = {
  version: 1,
  role: "editor",
  scope: "desktop-file",
  path: "/home/agent/workspace/main.ts",
  name: "main.ts",
  kind: "file",
  contentType: "text/typescript",
  local: true,
};

describe("launch params", () => {
  it("reads scoped file launch params", () => {
    expect(openFileFromLaunchParams({ appkitsOpenFile: openFile })).toEqual(openFile);
  });

  it("ignores direct host messages in favor of SDK launch params", () => {
    expect(
      openFileFromLaunchParams({
        type: "DIRECT_HOST_LAUNCH_PARAMS",
        params: { appkitsOpenFile: openFile },
      }),
    ).toBeNull();
  });

  it("rejects folder launch params", () => {
    expect(
      openFileFromLaunchParams({
        appkitsOpenFile: { ...openFile, kind: "directory" },
      }),
    ).toBeNull();
  });
});
