import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      // Allow serving files from the public directory
      allow: ['..']
    },
    middlewareMode: false,
    // Configure headers - CSP handled separately for dev vs prod
    headers: {
      'Cache-Control': 'no-store',
    }
  },
  plugins: [
    react(),
    // Custom plugin to handle assets and CSP
    {
      name: 'csp-and-assets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Set relaxed CSP for development to allow Vite HMR
          if (command === 'serve') {
            res.setHeader(
              'Content-Security-Policy',
              [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval'", // Allow Vite HMR and inline scripts
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob: https:",
                "font-src 'self' data:",
                "connect-src 'self' ws: wss: https:",
                "worker-src 'self' blob:",
                "media-src 'self' blob: data:",
                "object-src 'none'",
                "base-uri 'self'"
                // Note: frame-ancestors removed from meta tag as it's ignored there
              ].join('; ')
            );
          }

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
    // Generate a _headers file for production CSP (Netlify/Vercel)
    outDir: 'dist',
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