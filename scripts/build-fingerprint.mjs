import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

const trackedFiles = [
  'frontend/src/components/Attendance.jsx',
  'backend/server.js',
  'backend/lib/security.js'
];

const runGit = (args) => {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return 'GIT_METADATA_UNAVAILABLE';
  }
};

const sha256File = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return 'FILE_UNAVAILABLE';
  }
};

const readText = (relativePath) => {
  try {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  } catch {
    return '';
  }
};

const readPackageVersion = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    return String(pkg.version || 'unknown');
  } catch {
    return 'unknown';
  }
};

const attendanceSource = readText('frontend/src/components/Attendance.jsx');
const markerResults = {
  technician_app: attendanceSource.includes('technician_app'),
  technicianAppLabel: attendanceSource.includes('Technician App'),
  amPmFormatter:
    attendanceSource.includes('formatAttendanceDisplayTime')
    && attendanceSource.includes("hours >= 12 ? 'PM' : 'AM'")
    && attendanceSource.includes('hours % 12 || 12')
};

console.log('[build-fingerprint] BEGIN');
console.log(`[build-fingerprint] cwd=${process.cwd()}`);
console.log(`[build-fingerprint] repoRoot=${repoRoot}`);
console.log(`[build-fingerprint] node=${process.version}`);
console.log(`[build-fingerprint] packageVersion=${readPackageVersion()}`);
console.log(`[build-fingerprint] gitHead=${runGit(['rev-parse', 'HEAD'])}`);
console.log(`[build-fingerprint] gitLog=${runGit(['log', '-1', '--oneline'])}`);
for (const relativePath of trackedFiles) {
  console.log(`[build-fingerprint] sha256 ${relativePath}=${sha256File(relativePath)}`);
}
for (const [marker, present] of Object.entries(markerResults)) {
  console.log(`[build-fingerprint] marker ${marker}=${present ? 'present' : 'missing'}`);
}
console.log('[build-fingerprint] END');
