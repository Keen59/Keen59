import { cp, mkdir } from "node:fs/promises";
import esbuild from "esbuild";

await mkdir("site", { recursive: true });
await esbuild.build({
  entryPoints: ["public/site-app.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile: "site/app.js",
  alias: {
    "node-html-parser": "./lib/html-dom.js",
  },
});
await cp("public/style.css", "site/style.css");
console.log("site build ready");
