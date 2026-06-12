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
    expect(openFileFromLaunchParams({ appkitsOpenFile: openFile })).toEqual(openFile);
  });

  it("maps desktop-root launch paths into the AppKits workspace root", () => {
    expect(
      openFileFromLaunchParams({
        appkitsOpenFile: {
          ...openFile,
          path: "/.config/appkits/desktop-icons.json",
          name: "desktop-icons.json",
          contentType: "application/json",
        },
      }),
    ).toMatchObject({
      path: "/home/agent/.config/appkits/desktop-icons.json",
      name: "desktop-icons.json",
    });
  });

  it("reads host launch and open-file messages", () => {
    expect(
      openFileFromHostMessage({
        type: "APPKITS_LAUNCH_PARAMS",
        params: { appkitsOpenFile: openFile },
      }),
    ).toEqual(openFile);
    expect(
      openFileFromHostMessage({
        type: "APPKITS_OPEN_FILE",
        file: openFile,
      }),
    ).toEqual(openFile);
  });

  it("rejects folder launch params", () => {
    expect(
      openFileFromLaunchParams({
        appkitsOpenFile: { ...openFile, kind: "directory" },
      }),
    ).toBeNull();
  });
});
