# SKUAS ERP Release Checklist

Use this checklist for every production update.

## A) Pre-Release

- [ ] Create backup of `backend/data/*.json` (or DB dump)
- [ ] Confirm API base URL for production is correct
- [ ] Confirm backend CORS allows production domain
- [ ] Run frontend build locally: `cd frontend && npm run build`
- [ ] Validate no critical console/runtime errors
- [ ] Tag release in Git (example: `v1.0.4`)

## B) Deploy

- [ ] Deploy backend changes first (if any)
- [ ] Restart backend process and verify health
- [ ] Upload `frontend/dist/` to Hostinger `public_html/`
- [ ] Hard refresh and verify latest UI loaded

## C) Post-Release Validation

- [ ] Login/logout works
- [ ] Customer module loads and saves records
- [ ] Customer dedup import wizard works
- [ ] Payroll dashboard loads
- [ ] Advance salary add/delete works
- [ ] HR dashboard loads charts/cards
- [ ] No blocking error in browser console/network

## D) If Issue Found

- [ ] Capture screenshot + error details
- [ ] Roll back to previous stable frontend build
- [ ] Roll back backend to previous stable release
- [ ] Restore backup data if data integrity issue exists
- [ ] Re-verify core flows

## E) Release Log

- Date:
- Release tag:
- Deployed by:
- Scope:
- Rollback required? (Yes/No):
- Notes:

