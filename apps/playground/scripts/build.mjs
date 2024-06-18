/**
 * I can't seem to get vite to build the project.
 * So I'm using esbuild to build the project until I can figure out how to get vite to work.
 */

import * as esbuild from "esbuild";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import { tailwindPlugin } from "esbuild-plugin-tailwindcss";
import * as fs from "fs";

const ourdir = "dist";
const outputName = `${Math.random().toString(36).substring(7)}-out`;

await esbuild.build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outfile: `${ourdir}/${outputName}.js`,
  minify: true,
  sourcemap: true,
  define: {
    global: "globalThis",
  },
  plugins: [
    NodeGlobalsPolyfillPlugin({
      buffer: true,
      process: true,
    }),
    NodeModulesPolyfillPlugin(),
    tailwindPlugin(),
  ],
});

// create index.html file
fs.writeFileSync(
  `${ourdir}/index.html`,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${outputName}.css" />
    <title>OpenAPI to Ts Rest Contract</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${outputName}.js"></script>
  </body>
</html>`
);
