/**
 * scripts/build-single-html.mjs
 *
 * Compresses the entire Motion Drive 3D game (HTML + Tailwind CSS + Three.js + GSAP +
 * all game, UI, and webcam steering modules) into ONE self-contained `index.html` file,
 * and also packages a ready-to-drop `motion-drive-3d-netlify-drop.zip` for Netlify Drop.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const tempOutDir = path.join(rootDir, '.singlefile-tmp');

/**
 * Minimal pure-Node ZIP archive builder (DEFLATE) so zero external OS tools are required.
 */
function createZipArchive(entries) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, content } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const rawBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const deflated = zlib.deflateRawSync(rawBuf, { level: 9 });
    const crc = crc32(rawBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed (2.0)
    localHeader.writeUInt16LE(0, 6);          // Flags
    localHeader.writeUInt16LE(8, 8);          // Compression method: Deflate (8)
    localHeader.writeUInt16LE(0, 10);         // Mod time
    localHeader.writeUInt16LE(0, 12);         // Mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(deflated.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, deflated);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(deflated.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + deflated.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

async function generateSingleHtml() {
  fs.rmSync(tempOutDir, { recursive: true, force: true });

  await build({
    root: rootDir,
    configFile: false,
    publicDir: false,
    plugins: [tailwindcss()],
    build: {
      outDir: tempOutDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 10_000_000,
      minify: 'esbuild',
      rollupOptions: {
        // In single-file mode, MediaPipe loads from jsDelivr CDN (matched JS + WASM)
        external: ['@mediapipe/tasks-vision'],
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  const assetsDir = path.join(tempOutDir, 'assets');
  const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

  let cssCode = '';
  let jsCode = '';

  for (const file of assetFiles) {
    const full = path.join(assetsDir, file);
    if (file.endsWith('.css')) {
      cssCode += fs.readFileSync(full, 'utf8') + '\n';
    } else if (file.endsWith('.js')) {
      jsCode += fs.readFileSync(full, 'utf8') + '\n';
    }
  }

  let html = fs.readFileSync(path.join(tempOutDir, 'index.html'), 'utf8');

  // Remove external <link rel="stylesheet" ...assets/...> and <script ...assets/...>
  html = html.replace(/<link[^>]+href="[^"]*assets\/[^"]*\.css"[^>]*>/gi, '');
  html = html.replace(/<script[^>]+src="[^"]*assets\/[^"]*\.js"[^>]*><\/script>/gi, '');
  html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>/gi, '');

  // Strip the preview-only export download links inside the standalone output itself
  html = html.replace(/<a\b[^>]*data-export-only="true"[\s\S]*?<\/a>/gi, '');

  // Escape any literal </script> inside minified JS so HTML parser never closes early
  const safeJs = jsCode.replace(/<\/script/gi, '<\\/script');

  const importMapTag = `<script type="importmap">{"imports":{"@mediapipe/tasks-vision":"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs"}}</script>`;
  const styleTag = `<style>${cssCode.trim()}</style>`;
  const flagScript = `<script>window.__MOTION_DRIVE_SINGLE_FILE__=true;</script>`;
  const bundleScript = `<script type="module">${safeJs.trim()}</script>`;

  html = html.replace('</head>', `${importMapTag}\n${styleTag}\n</head>`);
  html = html.replace('</body>', `${flagScript}\n${bundleScript}\n</body>`);

  // Write standalone/index.html + public/motion-drive-3d-single.html
  const standaloneDir = path.join(rootDir, 'standalone');
  const publicDir = path.join(rootDir, 'public');
  fs.mkdirSync(standaloneDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const standaloneHtmlPath = path.join(standaloneDir, 'index.html');
  const publicHtmlPath = path.join(publicDir, 'motion-drive-3d-single.html');
  fs.writeFileSync(standaloneHtmlPath, html, 'utf8');
  fs.writeFileSync(publicHtmlPath, html, 'utf8');

  // Also package a 1-file Netlify Drop ZIP (contains index.html + _headers for camera permission)
  const netlifyHeaders = `/*\n  Permissions-Policy: camera=(self)\n`;
  const zipBuffer = createZipArchive([
    { name: 'index.html', content: html },
    { name: '_headers', content: netlifyHeaders },
  ]);
  const zipPath = path.join(publicDir, 'motion-drive-3d-netlify-drop.zip');
  fs.writeFileSync(zipPath, zipBuffer);

  fs.rmSync(tempOutDir, { recursive: true, force: true });

  const htmlKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  const zipKb = (zipBuffer.length / 1024).toFixed(1);
  console.log(`Built standalone/index.html (${htmlKb} KB) and motion-drive-3d-netlify-drop.zip (${zipKb} KB)`);
}

generateSingleHtml().catch((err) => {
  console.error(err);
  process.exit(1);
});
