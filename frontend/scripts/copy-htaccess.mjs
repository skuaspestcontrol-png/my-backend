import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sourceFile = path.join(rootDir, 'public', '.htaccess');
const targetFile = path.join(rootDir, 'dist', '.htaccess');
const deployedPublicDir = path.resolve(rootDir, '..', 'backend', 'public');

if (!fs.existsSync(sourceFile)) {
  console.warn('[copy-htaccess] Source file not found:', sourceFile);
  process.exit(0);
}

fs.mkdirSync(path.dirname(targetFile), { recursive: true });
fs.copyFileSync(sourceFile, targetFile);
console.log('[copy-htaccess] Copied .htaccess to dist');

// Keep the Node server's tracked fallback bundle in sync for deployments without frontend/dist.
if (fs.existsSync(path.join(rootDir, 'dist', 'index.html'))) {
  fs.cpSync(path.join(rootDir, 'dist'), deployedPublicDir, { recursive: true, force: true });
  console.log('[copy-htaccess] Synced frontend bundle to backend/public');
}
