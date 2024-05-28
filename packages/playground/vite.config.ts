import path from "path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type ViteDevServer, type Plugin } from "vite";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import rollupNodePolyFill from "@rollup/plugin-node-resolve";

export default defineConfig({
  plugins: [react(), pluginWatchNodeModules(["@openapi-to-ts-rest/core"])],
  build: {
    rollupOptions: {
      plugins: [rollupNodePolyFill({ browser: true })],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@openapi-to-ts-rest/core"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
        NodeModulesPolyfillPlugin(),
      ],
    },
  },
});

export function pluginWatchNodeModules(modules: string[]): Plugin {
  // Merge module into pipe separated string for RegExp() below.
  const pattern = `/node_modules\\/(?!${modules.join("|")}).*/`;
  return {
    name: "watch-node-modules",
    configureServer: (server: ViteDevServer): void => {
      server.watcher.options = {
        ...server.watcher.options,
        ignored: [new RegExp(pattern), "**/.git/**"],
      };
    },
  };
}
