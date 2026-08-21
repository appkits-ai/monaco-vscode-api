/**
 * Vitest 配置：happy-dom 单测，并沿用 Vite 的 `?worker&url` 解析。
 * Vitest config: happy-dom unit tests, reusing Vite `?worker&url` resolution.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
  },
});
