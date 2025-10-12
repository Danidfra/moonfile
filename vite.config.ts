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
    },
    middlewareMode: false,
    // Configure headers for WASM files
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.emulatorjs.org blob:",
        "worker-src 'self' blob:",
        "connect-src 'self' https://cdn.emulatorjs.org blob: data: wss:",
        "img-src 'self' https: data: blob:",
        "media-src 'self' data: blob:",
        "style-src 'self' 'unsafe-inline' https://cdn.emulatorjs.org",
        "frame-src 'self' blob:",
        "child-src 'self' blob:",
        "frame-ancestors 'self'"
      ].join('; ')
    }
  },
  plugins: [
    react(),
    // Custom plugin to handle WASM files properly
    {
      name: 'wasm-headers',
      configureServer(server) {
        server.middlewares.use('/wasm', (req, res, next) => {
          if (req.url?.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Encoding', 'identity'); // Disable compression
          }
          next();
        });
      }
    }
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