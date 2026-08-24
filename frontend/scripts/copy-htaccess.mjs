import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sourceFile = path.join(rootDir, 'public', '.htaccess');
const targetFile = path.join(rootDir, 'dist', '.htaccess');

if (!fs.existsSync(sourceFile)) {
  console.warn('[copy-htaccess] Source file not found:', sourceFile);
  process.exit(0);
}

fs.mkdirSync(path.dirname(targetFile), { recursive: true });
fs.copyFileSync(sourceFile, targetFile);
console.log('[copy-htaccess] Copied .htaccess to dist');
