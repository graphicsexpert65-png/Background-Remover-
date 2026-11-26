import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function modelAssetsPlugin(): Plugin {
  return {
    name: 'model-assets-server',
    configureServer(server) {
      // 1. Rewrite BatchRemover and other component requests if loaded with flat or root path
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          const cleanUrl = req.url.split('?')[0];
          const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
          if (cleanUrl === '/BatchRemover.tsx' || cleanUrl === '/components/BatchRemover.tsx') {
            req.url = '/src/components/BatchRemover.tsx' + query;
          } else if (cleanUrl === '/SingleRemover.tsx' || cleanUrl === '/components/SingleRemover.tsx') {
            req.url = '/src/components/SingleRemover.tsx' + query;
          } else if (cleanUrl === '/PassportMaker.tsx' || cleanUrl === '/components/PassportMaker.tsx') {
            req.url = '/src/components/PassportMaker.tsx' + query;
          }
        }
        next();
      });

      // 2. Resilient fallback handler for onnxruntime-web dynamic module imports in Vite dev server
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/node_modules/.vite/deps/')) {
          return next();
        }

        const cleanUrl = req.url.split('?')[0];
        const fileName = path.basename(cleanUrl);
        const depsDir = path.resolve(process.cwd(), 'node_modules', '.vite', 'deps');
        const exactFilePath = path.join(depsDir, fileName);

        // If the exact file exists on disk, let Vite serve it naturally
        if (fs.existsSync(exactFilePath) && fs.statSync(exactFilePath).isFile()) {
          return next();
        }

        // Fallback for onnxruntime-web bundle chunk: ort.bundle.min-*.js / .mjs
        if (
          fileName.startsWith('ort.bundle.min-') ||
          fileName === 'ort.bundle.min.js' ||
          fileName === 'ort.bundle.min.mjs' ||
          fileName === 'onnxruntime-web.js'
        ) {
          try {
            if (fs.existsSync(depsDir)) {
              const files = fs.readdirSync(depsDir);
              const matchingChunk =
                files.find((f) => f.startsWith('ort.bundle.min-') && f.endsWith('.js')) ||
                files.find((f) => f === 'onnxruntime-web.js');

              if (matchingChunk) {
                res.setHeader('Content-Type', 'application/javascript');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.statusCode = 200;
                return fs.createReadStream(path.join(depsDir, matchingChunk)).pipe(res);
              }
            }

            // Secondary fallback: serve directly from onnxruntime-web package dist
            const ortDistPath = path.resolve(
              process.cwd(),
              'node_modules',
              'onnxruntime-web',
              'dist',
              'ort.bundle.min.mjs'
            );
            if (fs.existsSync(ortDistPath)) {
              res.setHeader('Content-Type', 'application/javascript');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              return fs.createReadStream(ortDistPath).pipe(res);
            }
          } catch (err) {
            console.warn('[vite-deps-fallback] Error serving ort.bundle.min fallback:', err);
          }
        }

        // Fallback for onnxruntime-web webgpu bundle chunk: ort.webgpu.bundle.min-*.js
        if (
          fileName.startsWith('ort.webgpu.bundle.min-') ||
          fileName === 'ort.webgpu.bundle.min.js' ||
          fileName === 'ort.webgpu.bundle.min.mjs'
        ) {
          try {
            if (fs.existsSync(depsDir)) {
              const files = fs.readdirSync(depsDir);
              const matchingChunk =
                files.find((f) => f.startsWith('ort.webgpu.bundle.min-') && f.endsWith('.js')) ||
                files.find((f) => f.startsWith('ort.bundle.min-') && f.endsWith('.js')) ||
                files.find((f) => f === 'onnxruntime-web.js');

              if (matchingChunk) {
                res.setHeader('Content-Type', 'application/javascript');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.statusCode = 200;
                return fs.createReadStream(path.join(depsDir, matchingChunk)).pipe(res);
              }
            }

            // Secondary fallback: serve directly from onnxruntime-web webgpu dist
            const ortWebGpuDistPath = path.resolve(
              process.cwd(),
              'node_modules',
              'onnxruntime-web',
              'dist',
              'ort.webgpu.bundle.min.mjs'
            );
            if (fs.existsSync(ortWebGpuDistPath)) {
              res.setHeader('Content-Type', 'application/javascript');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              return fs.createReadStream(ortWebGpuDistPath).pipe(res);
            }
          } catch (err) {
            console.warn('[vite-deps-fallback] Error serving ort.webgpu fallback:', err);
          }
        }

        next();
      });

      // 3. Serve static and cached AI segmentation model assets and WebAssembly binaries
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/models/')) {
          return next();
        }

        const urlPath = req.url.split('?')[0];
        const fileName = path.basename(urlPath);
        const localPath = path.resolve(process.cwd(), 'public', 'models', fileName);

        if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
          if (fileName.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
          } else if (fileName.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          } else if (fileName.endsWith('.mjs') || fileName.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
          } else {
            res.setHeader('Content-Type', 'application/octet-stream');
          }
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Access-Control-Allow-Origin', '*');
          const stream = fs.createReadStream(localPath);
          return stream.pipe(res);
        }

        // If not found locally, proxy-fetch from staticimgly CDN and cache locally
        try {
          const cdnUrl = `https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/${fileName}`;
          const cdnRes = await fetch(cdnUrl);
          if (cdnRes.ok) {
            const buffer = Buffer.from(await cdnRes.arrayBuffer());
            fs.mkdirSync(path.dirname(localPath), { recursive: true });
            fs.writeFileSync(localPath, buffer);

            const contentType = cdnRes.headers.get('content-type') || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 200;
            return res.end(buffer);
          }
        } catch (fetchErr) {
          console.warn(`[model-assets] Proxy fetch failed for ${fileName}:`, fetchErr);
        }

        // IMPORTANT: NEVER allow /models/* to fall through to Vite SPA index.html!
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Asset ${fileName} not found` }));
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), modelAssetsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['@bg0/browser', 'jszip', 'jspdf'],
    },
    build: {
      chunkSizeWarningLimit: 3000,
      target: 'esnext',
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

