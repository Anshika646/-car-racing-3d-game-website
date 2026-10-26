import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destDir = path.join(rootDir, 'public', 'wasm');

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir)) {
    fs.copyFileSync(path.join(srcDir, entry), path.join(destDir, entry));
  }
}
