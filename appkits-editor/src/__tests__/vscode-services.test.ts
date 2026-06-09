import { describe, expect, it, vi } from "vitest";
import {
  initializeVscodeEditorServices,
  resetVscodeEditorServicesForTests,
} from "../vscode-services";

describe("initializeVscodeEditorServices", () => {
  it("initializes service overrides once before editor creation", async () => {
    resetVscodeEditorServicesForTests();
    const initializedServices: Record<string, unknown>[] = [];
    const initialize = vi.fn(async (services: Record<string, unknown>) => {
      initializedServices.push(services);
    });
    const installWorkers = vi.fn();
    const installDefaultExtensions = vi.fn(async () => undefined);
    const serviceOverrides = vi.fn(() => ({
      configuration: {},
      theme: {},
      textmate: {},
      languages: {},
      files: {},
      model: {},
    }));

    await initializeVscodeEditorServices({
      initialize,
      installWorkers,
      installDefaultExtensions,
      serviceOverrides,
    });
    await initializeVscodeEditorServices({
      initialize,
      installWorkers,
      installDefaultExtensions,
      serviceOverrides,
    });

    expect(installWorkers).toHaveBeenCalledTimes(1);
    expect(installDefaultExtensions).toHaveBeenCalledTimes(1);
    expect(serviceOverrides).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initializedServices[0]).toMatchObject({
      configuration: {},
      theme: {},
      textmate: {},
      languages: {},
      files: {},
      model: {},
    });
    resetVscodeEditorServicesForTests();
  });
});
