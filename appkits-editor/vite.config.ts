/**
 * Vite 配置：把 monaco-vscode CSS 收成字符串，并把 worker 图打成独立 ESM 文件。
 * Vite config: inline monaco-vscode CSS as strings and emit worker graphs as ESM files.
 */
import importMetaUrlPlugin from "@codingame/esbuild-import-meta-url-plugin";
import { defineConfig, type Plugin } from "vite";

const monacoVscodePackages = [
  "@codingame/monaco-vscode-api",
  "@codingame/monaco-vscode-base-service-override",
  "@codingame/monaco-vscode-configuration-service-override",
  "@codingame/monaco-vscode-environment-service-override",
  "@codingame/monaco-vscode-extensions-service-override",
  "@codingame/monaco-vscode-files-service-override",
  "@codingame/monaco-vscode-host-service-override",
  "@codingame/monaco-vscode-languages-service-override",
  "@codingame/monaco-vscode-layout-service-override",
  "@codingame/monaco-vscode-model-service-override",
  "@codingame/monaco-vscode-quickaccess-service-override",
  "@codingame/monaco-vscode-terminal-service-override",
  "@codingame/monaco-vscode-textmate-service-override",
  "@codingame/monaco-vscode-theme-service-override",
  "monaco-editor",
  "vscode",
];

/**
 * 把 monaco-vscode / monaco-editor CSS 收成 `?inline` 字符串，主 bundle 与 worker 共用。
 * Loads monaco-vscode / monaco-editor CSS as `?inline` strings for the app and worker graphs.
 */
function monacoCssAsStringPlugin(): Plugin {
  return {
    name: "load-monaco-vscode-css-as-string",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, options);
      if (
        resolved?.id.match(
          /node_modules\/(@codingame\/monaco-vscode|vscode|monaco-editor).*\.css$/,
        )
      ) {
        return {
          ...resolved,
          id: `${resolved.id}?inline`,
        };
      }
      return undefined;
    },
  };
}

export default defineConfig({
  build: {
    target: "esnext",
  },
  worker: {
    format: "es",
    plugins: () => [monacoCssAsStringPlugin()],
  },
  plugins: [
    monacoCssAsStringPlugin(),
    {
      name: "configure-monaco-vscode-dev-headers",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((_request, response, next) => {
          response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
          response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          next();
        });
      },
    },
  ],
  esbuild: {
    minifySyntax: false,
  },
  optimizeDeps: {
    include: [
      ...monacoVscodePackages,
      "@codingame/monaco-vscode-api/extensions",
      "@codingame/monaco-vscode-api/monaco",
      "@vscode/vscode-languagedetection",
      "marked",
    ],
    esbuildOptions: {
      plugins: [importMetaUrlPlugin],
      tsconfig: "./tsconfig.json",
    },
  },
  resolve: {
    dedupe: monacoVscodePackages,
  },
});
