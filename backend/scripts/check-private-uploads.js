#!/usr/bin/env node
const fs = require('fs');

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || '') : fallback;
};

const baseUrl = getArg('--base-url', process.env.STAGING_BASE_URL || process.env.SKUAS_CRM_BASE_URL || '').replace(/\/+$/, '');
const bearer = getArg('--bearer', process.env.SKUAS_CRM_TEST_BEARER || '');
const cookie = getArg('--cookie', process.env.SKUAS_CRM_TEST_COOKIE || '');
const pathsFile = getArg('--paths-file', '');
const defaultPaths = [
  '/uploads/employees/aadhaar/sample.pdf',
  '/uploads/employees/pan/sample.pdf',
  '/uploads/employees/documents/sample.pdf',
  '/uploads/payroll/salary-slips/sample.pdf',
  '/uploads/imports/sample.csv',
  '/uploads/customer-imports/sample.csv'
];

if (!baseUrl) {
  console.error('Usage: node backend/scripts/check-private-uploads.js --base-url https://crm.example.com [--paths-file paths.txt] [--bearer token | --cookie cookie]');
  process.exit(2);
}

const paths = pathsFile
  ? fs.readFileSync(pathsFile, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  : defaultPaths;

const classify = (status) => (status === 401 || status === 403 || status === 404 ? 'protected-or-absent' : status >= 200 && status < 300 ? 'publicly-readable' : 'review');

(async () => {
  for (const [index, rawPath] of paths.entries()) {
    const pathname = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const anonymous = await fetch(`${baseUrl}${pathname}`, { method: 'HEAD', redirect: 'manual' });
    const row = { index: index + 1, anonymousStatus: anonymous.status, anonymousResult: classify(anonymous.status) };
    if (bearer || cookie) {
      const headers = {};
      if (bearer) headers.Authorization = `Bearer ${bearer}`;
      if (cookie) headers.Cookie = cookie;
      const authorized = await fetch(`${baseUrl}${pathname}`, { method: 'HEAD', headers, redirect: 'manual' });
      row.authorizedStatus = authorized.status;
      row.authorizedResult = authorized.status >= 200 && authorized.status < 300 ? 'allowed' : 'not-allowed';
    }
    console.log(JSON.stringify(row));
  }
})().catch((error) => {
  console.error('Private upload check failed:', error.message);
  process.exit(1);
});
