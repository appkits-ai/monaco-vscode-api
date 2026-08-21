/**
 * 拒绝把 extension-host / textmate / editor worker 收成未打包的 data: 入口。
 * Rejects unbundled data: worker stubs for extension-host, textmate, and editor.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "dist", "assets");
const forbidden = [
  "../vscode/src/vs/workbench/api/worker/extensionHostWorkerMain.js",
  "CmltcG9ydCAnLi4vdnNjb2RlL3NyYy92cy93b3JrYmVuY2gvYXBpL3dvcmtlci9leHRlbnNpb25Ib3N0V29ya2VyTWFpbi5qcyc7Cg==",
  "CmltcG9ydCAnLi92c2NvZGUvc3JjL3ZzL3dvcmtiZW5jaC9zZXJ2aWNlcy90ZXh0TWF0ZS9icm93c2VyL2JhY2tncm91bmRUb2tlbml6YXRpb24vd29ya2VyL3RleHRNYXRlVG9rZW5pemF0aW9uV29ya2VyLndvcmtlck1haW4uanMnOwo=",
  "ZXhwb3J0ICogZnJvbSAnQGNvZGluZ2FtZS9tb25hY28tdnNjb2RlLWFwaS93b3JrZXJzL2VkaXRvci53b3JrZXIn",
];

const names = readdirSync(assets);
const indexFiles = names.filter((name) => name.startsWith("index-") && name.endsWith(".js"));
if (indexFiles.length === 0) {
  throw new Error("assert-bundled-workers: missing dist/assets/index-*.js");
}

let sawExtensionHostChunk = false;
for (const name of indexFiles) {
  const text = readFileSync(join(assets, name), "utf8");
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      throw new Error(
        `assert-bundled-workers: ${name} still embeds an unbundled worker stub (${needle.slice(0, 72)})`,
      );
    }
  }
  if (text.includes("/assets/extensionHost.worker-")) {
    sawExtensionHostChunk = true;
  }
}
if (!sawExtensionHostChunk) {
  throw new Error("assert-bundled-workers: index does not point at /assets/extensionHost.worker-*");
}

const extensionHostFiles = names.filter(
  (name) => name.startsWith("extensionHost.worker-") && name.endsWith(".js"),
);
if (extensionHostFiles.length === 0) {
  throw new Error("assert-bundled-workers: missing dist/assets/extensionHost.worker-*.js");
}
for (const name of extensionHostFiles) {
  const size = statSync(join(assets, name)).size;
  if (size < 10_000) {
    throw new Error(`assert-bundled-workers: ${name} is ${size} bytes; expected a bundled worker`);
  }
}

console.log(
  `assert-bundled-workers: ok index=${indexFiles.join(",")} extensionHost=${extensionHostFiles.join(",")}`,
);
