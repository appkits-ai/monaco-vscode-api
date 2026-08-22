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
  "data:text/javascript",
  "../vscode/src/vs/workbench/api/worker/extensionHostWorkerMain.js",
  "CmltcG9ydCAnLi4vdnNjb2RlL3NyYy92cy93b3JrYmVuY2gvYXBpL3dvcmtlci9leHRlbnNpb25Ib3N0V29ya2VyTWFpbi5qcyc7Cg==",
  "CmltcG9ydCAnLi92c2NvZGUvc3JjL3ZzL3dvcmtiZW5jaC9zZXJ2aWNlcy90ZXh0TWF0ZS9icm93c2VyL2JhY2tncm91bmRUb2tlbml6YXRpb24vd29ya2VyL3RleHRNYXRlVG9rZW5pemF0aW9uV29ya2VyLndvcmtlck1haW4uanMnOwo=",
  "ZXhwb3J0ICogZnJvbSAnQGNvZGluZ2FtZS9tb25hY28tdnNjb2RlLWFwaS93b3JrZXJzL2VkaXRvci53b3JrZXIn",
];

/**
 * 已认领 worker 必须同时有分层 chunk 文件和 index 引用。
 * Claimed workers must have both a hierarchical chunk file and an index reference.
 */
const requiredWorkers = [
  {
    kind: "extensionHost",
    filePrefix: "extensionHost.worker-",
    indexNeedle: "/assets/extensionHost.worker-",
    minBytes: 10_000,
  },
  {
    kind: "editor",
    filePrefix: "editor.worker-",
    indexNeedle: "/assets/editor.worker-",
    minBytes: 10_000,
  },
  {
    kind: "textmate",
    filePrefix: "worker-",
    indexNeedle: "/assets/worker-",
    minBytes: 10_000,
  },
];

const names = readdirSync(assets);
const indexFiles = names.filter((name) => name.startsWith("index-") && name.endsWith(".js"));
if (indexFiles.length === 0) {
  throw new Error("assert-bundled-workers: missing dist/assets/index-*.js");
}

const indexTexts = indexFiles.map((name) => ({
  name,
  text: readFileSync(join(assets, name), "utf8"),
}));
for (const { name, text } of indexTexts) {
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      throw new Error(
        `assert-bundled-workers: ${name} still embeds an unbundled worker stub (${needle.slice(0, 72)})`,
      );
    }
  }
}

const found = [];
for (const worker of requiredWorkers) {
  const missingIndex = indexTexts
    .filter(({ text }) => !text.includes(worker.indexNeedle))
    .map(({ name }) => name);
  if (missingIndex.length > 0) {
    throw new Error(
      `assert-bundled-workers: ${missingIndex.join(",")} does not point at ${worker.indexNeedle}*`,
    );
  }
  const files = names.filter(
    (name) => name.startsWith(worker.filePrefix) && name.endsWith(".js"),
  );
  if (files.length === 0) {
    throw new Error(
      `assert-bundled-workers: missing dist/assets/${worker.filePrefix}*.js (${worker.kind})`,
    );
  }
  for (const name of files) {
    const size = statSync(join(assets, name)).size;
    if (size < worker.minBytes) {
      throw new Error(
        `assert-bundled-workers: ${name} is ${size} bytes; expected a bundled ${worker.kind} worker`,
      );
    }
  }
  found.push(`${worker.kind}=${files.join(",")}`);
}

console.log(`assert-bundled-workers: ok index=${indexFiles.join(",")} ${found.join(" ")}`);
