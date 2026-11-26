# Graphics Expert — Background Remover

Browser-based background removal using BG0, with single image, batch removal and passport photo tools.

## Local development

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

## Cloudflare Pages deployment

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `NODE_VERSION=22`

Image processing runs in the visitor's browser. The BG0 model may need to download on first use and processing speed depends on the visitor's device.
