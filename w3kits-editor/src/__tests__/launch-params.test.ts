import { describe, expect, it } from "vitest";
import { openFileFromHostMessage, openFileFromLaunchParams } from "../launch-params";

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
    expect(openFileFromLaunchParams({ w3kitsOpenFile: openFile })).toEqual(openFile);
  });

  it("reads host launch and open-file messages", () => {
    expect(
      openFileFromHostMessage({
        type: "W3KITS_LAUNCH_PARAMS",
        params: { w3kitsOpenFile: openFile },
      }),
    ).toEqual(openFile);
    expect(
      openFileFromHostMessage({
        type: "W3KITS_OPEN_FILE",
        file: openFile,
      }),
    ).toEqual(openFile);
  });

  it("rejects folder launch params", () => {
    expect(
      openFileFromLaunchParams({
        w3kitsOpenFile: { ...openFile, kind: "directory" },
      }),
    ).toBeNull();
  });
});
