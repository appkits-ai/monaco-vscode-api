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

  it("rejects folder launch params", () => {
    expect(
      openFileFromLaunchParams({
        appkitsOpenFile: { ...openFile, kind: "directory" },
      }),
    ).toBeNull();
  });
});
