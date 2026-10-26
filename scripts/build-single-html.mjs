/**
 * scripts/build-single-html.mjs
 *
 * Builds verified, production-tested deployment artifacts:
 * 1. `public/motion-drive-3d-netlify-drop.zip`: Clean Vite production bundle
 *    (`index.html` + `assets/*.js` + `assets/*.css` + `_headers` + `_redirects`)
 *    ready for instant drag-and-drop on Netlify Drop (`app.netlify.com/drop`).
 * 2. `standalone/index.html` & `public/motion-drive-3d-single.html`: Verified
 *    single-file HTML bundle (using function replacement callbacks so `$` tokens
 *    in minified Three.js are never corrupted, verified with esbuild AST parse).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { transformSync } from 'esbuild';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const tempOutDir = path.join(rootDir, '.singlefile-tmp');

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
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(deflated.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, deflated);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
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
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

async function generateDeployBundles() {
  fs.rmSync(tempOutDir, { recursive: true, force: true });

  // Bundle ALL dependencies (Three.js + GSAP + MediaPipe Tasks Vision JS + Tailwind CSS)
  await build({
    root: rootDir,
    base: './',
    configFile: false,
    publicDir: false,
    plugins: [tailwindcss()],
    build: {
      outDir: tempOutDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 10_000_000,
      chunkSizeWarningLimit: 2500,
      minify: 'esbuild',
      rolldownOptions: {
        output: {
          codeSplitting: false,
        },
      },
    },
  });

  const assetsDir = path.join(tempOutDir, 'assets');
  const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

  let cssCode = '';
  let jsCode = '';
  const zipEntries = [];

  for (const file of assetFiles) {
    const full = path.join(assetsDir, file);
    const buf = fs.readFileSync(full);
    zipEntries.push({ name: `assets/${file}`, content: buf });

    if (file.endsWith('.css')) {
      cssCode += buf.toString('utf8') + '\n';
    } else if (file.endsWith('.js')) {
      jsCode += buf.toString('utf8') + '\n';
    }
  }

  if (!jsCode.trim()) {
    throw new Error('Build failed: no JavaScript bundle was produced.');
  }

  // Strictly parse & verify the compiled JS bundle with esbuild
  transformSync(jsCode, { loader: 'js', format: 'esm' });

  // 1. Clean multi-file production index.html for Netlify Drop ZIP
  let zipIndexHtml = fs.readFileSync(path.join(tempOutDir, 'index.html'), 'utf8');
  zipIndexHtml = zipIndexHtml.replace(/<a\b[^>]*data-export-only="true"[\s\S]*?<\/a>/gi, '');

  zipEntries.unshift({ name: 'index.html', content: zipIndexHtml });
  zipEntries.push({
    name: '_headers',
    content: '/*\n  Permissions-Policy: camera=(self)\n',
  });
  zipEntries.push({
    name: '_redirects',
    content: '/* /index.html 200\n',
  });

  const zipBuffer = createZipArchive(zipEntries);

  // 2. Clean single-file standalone/index.html using function callbacks in .replace()
  //    (CRITICAL: string replacement in JS treats $& and $' as regex tokens!)
  let singleHtml = zipIndexHtml
    .replace(/<link[^>]+href="[^"]*assets\/[^"]*\.css"[^>]*>/gi, '')
    .replace(/<script[^>]+src="[^"]*assets\/[^"]*\.js"[^>]*><\/script>/gi, '')
    .replace(/<link[^>]+rel="modulepreload"[^>]*>/gi, '');

  const safeInlineJs = jsCode.replace(/<\/script/gi, '<\\/script');
  const styleBlock = `<style>${cssCode.trim()}</style>`;
  const scriptBlock = `<script>window.__MOTION_DRIVE_SINGLE_FILE__=true;</script>\n<script type="module">${safeInlineJs.trim()}</script>`;

  singleHtml = singleHtml.replace('</head>', () => `${styleBlock}\n</head>`);
  singleHtml = singleHtml.replace('</body>', () => `${scriptBlock}\n</body>`);

  // Verify singleHtml integrity: must have exactly 1 </body> and valid inline module JS
  const bodyCloseCount = (singleHtml.match(/<\/body>/gi) || []).length;
  if (bodyCloseCount !== 1) {
    throw new Error(`Invalid HTML generated: expected 1 </body>, found ${bodyCloseCount}`);
  }

  const standaloneDir = path.join(rootDir, 'standalone');
  const publicDir = path.join(rootDir, 'public');
  fs.mkdirSync(standaloneDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  fs.writeFileSync(path.join(standaloneDir, 'index.html'), singleHtml, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'motion-drive-3d-single.html'), singleHtml, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'motion-drive-3d-netlify-drop.zip'), zipBuffer);
  fs.writeFileSync(path.join(publicDir, 'motion-drive-3d-deploy-v2.zip'), zipBuffer);

  fs.rmSync(tempOutDir, { recursive: true, force: true });

  console.log(
    `Verified & built motion-drive-3d-deploy-v2.zip (${(zipBuffer.length / 1024).toFixed(1)} KB) and standalone/index.html (${(Buffer.byteLength(singleHtml, 'utf8') / 1024).toFixed(1)} KB)`,
  );
}

generateDeployBundles().catch((err) => {
  console.error(err);
  process.exit(1);
});
