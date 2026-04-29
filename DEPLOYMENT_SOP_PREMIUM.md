# SKUAS ERP Deployment SOP (Hostinger Premium + External Backend)

Last updated: April 25, 2026

## 1) Recommended Architecture

Hostinger Premium Web Hosting is used for frontend static hosting.
Backend API (Node.js/Express) is hosted on a Node-compatible platform (VPS/Render/Railway/etc.).

- Frontend URL: `https://yourdomain.com`
- Backend API URL: `https://api.yourdomain.com` (or provider URL)

## 2) One-Time Setup

### Frontend environment

Create/update `frontend/.env.production`:

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

Note: frontend code should use `import.meta.env.VITE_API_BASE_URL` for API calls.

### Backend CORS

Allow frontend origin in backend CORS config:

- `https://yourdomain.com`
- `https://www.yourdomain.com` (if used)

### Domain mapping

- Point domain/subdomain DNS as required.
- If using `api.yourdomain.com`, ensure SSL is active.

## 3) Frontend Deploy (Hostinger Premium)

Run locally:

```bash
cd frontend
npm install
npm run build
```

Upload to Hostinger File Manager:

- Upload contents of `frontend/dist/` into `public_html/`
- Overwrite old files

After upload:

- Clear browser cache / hard refresh (`Ctrl+F5`)
- Confirm login + dashboard load

## 4) Backend Deploy (External Node Host)

General flow:

1. Upload/pull latest backend code
2. Install dependencies
3. Configure environment variables
4. Start/restart process manager

Typical commands:

```bash
cd backend
npm install
pm2 restart skuas-backend || pm2 start server.js --name skuas-backend
pm2 save
```

## 5) Data Backup Before Every Production Update

Backup at minimum:

- `backend/data/*.json` (or database dump if DB is used)
- `.env` and deployment configs

Use timestamped backup folders, for example:

- `backup/2026-04-25-pre-release/`

## 6) Hotfix Workflow (When Portal Needs Immediate Fix)

### Frontend-only hotfix

1. Apply fix locally
2. Build frontend (`npm run build`)
3. Upload new `dist/` to `public_html`
4. Verify affected page

### Backend-only hotfix

1. Apply fix in backend
2. Deploy backend
3. Restart backend process
4. Verify endpoint and frontend behavior

### Full-stack hotfix

1. Deploy backend first
2. Deploy frontend after backend is healthy
3. Run smoke tests

## 7) Smoke Test Checklist After Every Deploy

- Login works
- Dashboard loads without console errors
- Customer import dedup wizard opens and imports
- Payroll pages open
- Advance salary add/delete works
- HR dashboard widgets load
- Create/update/delete customer works

## 8) Rollback Procedure

If deployment fails:

1. Revert code to last stable release tag
2. Restore previous frontend `dist/` backup
3. Restore backend code/data backup
4. Restart backend process
5. Re-test critical flows

## 9) Release Versioning

Use semantic tags:

- `v1.0.0` initial stable
- `v1.0.1` hotfix
- `v1.1.0` minor feature release

Store release notes with:

- What changed
- Risk level
- Rollback point

