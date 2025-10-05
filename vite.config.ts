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
    // Configure headers for WASM files and CSP
    headers: {
      'Cache-Control': 'no-store',
      // CSP that allows local scripts and WASM
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' wss: ws:; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'self' blob:;",
    }
  },
  plugins: [
    react(),
    // Custom plugin to handle WASM files and EmulatorJS assets properly
    {
      name: 'emulator-assets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Handle WASM files
          if (req.url?.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Encoding', 'identity');
          }
          // Handle EmulatorJS JavaScript files
          else if (req.url?.includes('/emulatorjs/') && req.url?.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-store');
          }
          // Handle EmulatorJS CSS files
          else if (req.url?.includes('/emulatorjs/') && req.url?.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
            res.setHeader('Cache-Control', 'no-store');
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