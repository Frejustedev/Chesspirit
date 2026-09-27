// Copie Stockfish (GPL v3) dans public/vendor : programme séparé chargé dans un Web Worker.
// Les fichiers de licence sont servis avec le binaire (voir docs/LICENCES.md).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("stockfish/package.json"));
const out = path.resolve(import.meta.dirname, "../public/vendor/stockfish");
fs.mkdirSync(out, { recursive: true });
for (const f of [
  "bin/stockfish-19-lite-single.js",
  "bin/stockfish-19-lite-single.wasm",
  "Copying.txt",
  "README.md",
]) {
  fs.copyFileSync(path.join(pkgDir, f), path.join(out, path.basename(f)));
}
fs.writeFileSync(
  path.join(out, "SOURCE.txt"),
  "Stockfish.js 19.0.0 (GPL v3). Code source : https://github.com/nmrugg/stockfish.js/tree/v19.0.0 et https://github.com/official-stockfish/Stockfish\n",
);
console.log("✓ Stockfish copié dans public/vendor/stockfish");
