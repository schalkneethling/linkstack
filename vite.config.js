import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "css/**/*",
          dest: "css",
        },
        {
          src: "assets/**/*",
          dest: "assets",
        },
      ],
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.js",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
