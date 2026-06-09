import { defineConfig } from "vite";
import importMetaUrlPlugin from "@codingame/esbuild-import-meta-url-plugin";

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
  "@codingame/monaco-vscode-textmate-service-override",
  "@codingame/monaco-vscode-theme-service-override",
  "monaco-editor",
  "vscode",
];

export default defineConfig({
  build: {
    target: "esnext",
  },
  worker: {
    format: "es",
  },
  plugins: [
    {
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
    },
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
