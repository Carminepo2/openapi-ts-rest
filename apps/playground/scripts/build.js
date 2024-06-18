/**
 * I can't seem to get vite to build the project.
 * So I'm using esbuild to build the project until I can figure out how to get vite to work.
 */

import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import autoprefixer from "autoprefixer";
import * as esbuild from "esbuild";
import postCssPlugin from "esbuild-style-plugin";
import * as fs from "fs";
import tailwindcss from "tailwindcss";

const ourdir = "dist";
const outputName = `${Math.random().toString(36).substring(7)}-out`;

await esbuild.build({
  bundle: true,
  define: {
    global: "globalThis",
  },
  entryPoints: ["src/main.tsx"],
  minify: true,
  outfile: `${ourdir}/${outputName}.js`,
  plugins: [
    NodeGlobalsPolyfillPlugin({
      buffer: true,
      process: true,
    }),
    NodeModulesPolyfillPlugin(),
    postCssPlugin({
      postcss: {
        plugins: [tailwindcss, autoprefixer],
      },
    }),
  ],
  sourcemap: true,
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
