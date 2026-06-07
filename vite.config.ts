import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      "../../../../packages/nstep-motion-core/src": resolve(__dirname, "../../packages/nstep-motion-core/src"),
      "../../../../../packages/nstep-motion-core/src": resolve(__dirname, "../../packages/nstep-motion-core/src")
    }
  },
  server: {
    port: 5000,
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: true
  }
});
