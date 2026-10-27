import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apps = [
  ['../../driver_app/build/web', '../dist/driver'],
  ['../../parent_app/build/web', '../dist/parent']
];

for (const [src, dest] of apps) {
  const srcPath = path.resolve(__dirname, src);
  const destPath = path.resolve(__dirname, dest);
  if (fs.existsSync(srcPath)) {
    fs.cpSync(srcPath, destPath, { recursive: true });
    console.log(`[Postbuild] Successfully copied ${src} -> ${dest}`);
  } else {
    console.warn(`[Postbuild] Warning: Source path ${srcPath} does not exist.`);
  }
}
