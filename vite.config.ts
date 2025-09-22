import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      // Allow serving files from the public directory
      allow: ['..']
    }
  },
  plugins: [
    react(),
  ],
  // Ensure WASM files are served with correct MIME type
  assetsInclude: ['**/*.wasm'],
  build: {
    rollupOptions: {
      external: ['/lib/fceux/fceux-web.js'],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@std/encoding": "@jsr/std__encoding",
    },
  },
}));