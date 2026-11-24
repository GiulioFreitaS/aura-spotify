import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const yamlLicense = await readFile(resolve(root, "Extensions/aura-lyrics/LICENSE-js-yaml.txt"), "utf8");
const sourceModules = {
  name: "aura-source-modules",
  setup(builder) {
    builder.onResolve({ filter: /^\.\/node_modules\/aura-(?:lyrics|native)\// }, (args) => ({
      path: resolve(args.resolveDir, args.path.replace("./node_modules/", "./")),
    }));
  },
};

await build({
  absWorkingDir: root,
  entryPoints: ["Extensions/aura.js"],
  outfile: "dist/marketplace/aura.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  legalComments: "inline",
  banner: { js: "/*! AURA · https://github.com/GiulioFreitaS/aura-spotify\n" + yamlLicense.trim() + "\n*/" },
  plugins: [sourceModules],
});
