import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [entryPoint, outputFile] = globalThis.process.argv.slice(2);

if (!entryPoint || !outputFile) {
  throw new Error("Usage: node scripts/build-node.mjs <entry> <output>");
}

await build({
  entryPoints: [resolve(root, entryPoint)],
  outfile: resolve(root, outputFile),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: true
});
