# SKUAS CRM phase 2 security remediation

Date: 2026-09-10. Scope: follow-up work against the remaining blockers in `docs/security/SECURITY_AUDIT.md`. This is not a deployment record. No push, production migration, credential rotation, production write, or real email/WhatsApp send was performed.

## Remediation checklist

| Area | Status | Evidence / action |
|---|---|---|
| Rotate exposed DB/admin/WhatsApp credentials | OPERATOR ACTION REQUIRED | Code cannot rotate secrets safely. Rotate in Hostinger/MySQL/provider consoles, update env/runtime stores, and invalidate old sessions. |
| Verify sensitive uploads are unreachable outside Node | OPERATOR ACTION REQUIRED | Node has auth guards. Hostinger aliases, public_html copies, CDN, backup browsing, and mirrors must be checked after deployment with `backend/scripts/check-private-uploads.js`. |
| Handle caches/history/backups containing exposed secrets | OPERATOR ACTION REQUIRED | Requires incident response and coordinated Git/history/backups cleanup. |
| Legacy plaintext passwords | PARTIALLY FIXED | New/changed passwords are hashed. Added dry-run/apply script `backend/scripts/password-security-migration.js`; real migration not run. MySQL is only contacted when `--mysql` is supplied. |
| Durable session revocation | FIXED FOR TARGETED PATHS | Added file-backed session versions. Logout, admin password change/reset, employee password/access disable/delete, and admin force logout revoke previous tokens. |
| Sales/Operations/HR/payroll authorization matrix | PARTIALLY FIXED | Backend role gates exist for admin/settings, HR/payroll, technicians, marketing, and broad employee blocks. Full business record ownership for Sales/Operations remains staged-review work. |
| Message/document sharing regression | PARTIALLY FIXED | Existing path-bound share-token tests cover payroll and token isolation. Invoice/quotation/contract/renewal/customer delivery must be run in staging because live provider sends are intentionally skipped. |
| Nodemailer high advisory | NOT FIXED | Current code mitigates file/URL attachment abuse. Major upgrade remains untested against SMTP/provider flows. |
| Financial write validation | PARTIALLY FIXED | Added generic server-side decimal validation for financial fields in invoice/contract/quotation/payroll/HR/employee writes plus strict payment amount validation. Full accounting recomputation remains open. |
| Import resource protection | PARTIALLY FIXED | Customer import now limits rows, columns, cell length, upload bytes, and XLSX decompressed bytes. Employee/import archive malware scanning and full decompression-bomb handling remain open. |
| Production log redaction | PARTIALLY FIXED | Responses redact secrets and a log redaction helper exists. Remaining production `console.error` calls should keep message-only logging; full structured logger replacement remains open. |
| Google API dependency major | NOT FIXED | Must be tested separately against OAuth and Tasks in staging. |
| React Router advisory | NOT FIXED | App appears to use browser routing only, but v7 migration was not run. |
| Hostinger header geolocation | OPERATOR ACTION REQUIRED | Node policy sets `geolocation=(self)`. Current live Hostinger header blocks geolocation and must be changed. |

## Authorization matrix

`Allowed` means backend-side access is intended for that role after the current patch. `Own/assigned` means the route must be scoped to records assigned to that user. `Review` means a known release blocker remains.

| Endpoint pattern | Method | Admin | Sales | Sales Person | Operations | HR | Technician | Ownership requirement |
|---|---:|---|---|---|---|---|---|---|
| `/api/settings*`, `/api/google/integration*`, `/api/google/oauth/start`, `/api/uploads/delete` | write | Allowed | Denied | Denied | Denied | Denied | Denied | Admin only |
| `/api/admin*`, `/api/uploads-test` | any | Allowed | Denied | Denied | Denied | Denied | Denied | Admin/debug token only |
| `/api/employees*` | write | Allowed | Denied | Denied | Denied | Allowed | Denied | HR/admin only |
| `/api/employees` | read | Allowed | Limited | Limited | Limited | Allowed | Own limited row | Technician own identity only |
| `/api/hr/dashboard-summary`, `/api/hr/kanban`, `/api/hr/performance`, `/api/hr/reports*`, `/api/hr/employees*` | read/write | Allowed | Denied | Denied | Denied | Allowed | Denied except scoped self HR helpers | HR/admin only |
| `/api/payroll*` | read/write | Allowed | Denied | Denied | Denied | Allowed | Own read paths only | Employee-owned payroll item/slip for non-HR |
| `/api/attendance` | read/write | Allowed | Own/self | Own/self | Review | Allowed | Own/self | Non-HR cannot submit another employee ID |
| `/api/technicians/live`, `/api/technicians/:id/route-history` | read | Allowed | Denied | Denied | Allowed | Allowed | Denied | Operations/HR/admin only |
| `/api/technicians/location` | write | Allowed | Denied | Denied | Review | Allowed | Own only | Server overwrites technician identity from session |
| `/api/jobs`, `/api/service-visits` | read | Allowed | Review | Review | Allowed | Review | Assigned only | Technician assigned job only; Sales/Operations ownership needs staging review |
| `/api/jobs/:id`, `/api/service-visits/:id` | write | Allowed | Review | Review | Allowed | Review | Assigned limited fields only | Technician cannot change assignment or delete |
| `/api/customers`, `/api/invoices`, `/api/service-schedules` | read | Allowed | Review | Review | Review | Review | Assigned-job scoped list only | Technician cannot direct child reads |
| `/api/customers*`, `/api/contracts*`, `/api/quotations*`, `/api/invoices*`, `/api/payment-received*`, `/api/payments*`, `/api/renewals*`, `/api/complaints*` | write | Allowed | Review | Review | Review | Review | Denied except supported job completion | Sales/Operations/HR ownership still requires route-by-route business rules |
| `/api/whatsapp*`, `/api/email*` | read/write | Allowed | Review | Review | Review | Review | Narrow send-only exception | Recipient/document ownership must be verified in staging |
| `/api/whatsapp-marketing*` | read/write | Allowed | Allowed | Allowed | Denied | Denied | Denied | Campaign recipient eligibility rechecked before send |
| `/api/stock*` | read/write | Allowed | Review | Review | Review | Review | Read items only | Stock role model remains a release blocker |
| `/api/public/*` | public | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Public endpoints are rate/body bounded; website lead contract remains operator decision |

## Upload inventory

| Category / path | Classification | Backend status | Hostinger action |
|---|---|---|---|
| `/uploads/employees/aadhaar/*` | PRIVATE | HR/admin auth required | Remove direct static aliases and public_html copies |
| `/uploads/employees/pan/*` | PRIVATE | HR/admin auth required | Remove direct static aliases and public_html copies |
| `/uploads/employees/documents/*` | PRIVATE | HR/admin auth required | Remove direct static aliases and public_html copies |
| `/uploads/payroll/*`, `/uploads/payroll/salary-slips/*`, `/uploads/salary-slips/*` | PRIVATE | HR/admin or path-bound share token for supported document routes | Must route through Node, not static hosting |
| `/uploads/imports/*`, `/uploads/customer-imports/*` | PRIVATE | HR/admin auth required | Keep outside public_html and CDN |
| `/uploads/employees/photos/*` | PUBLIC-LIMITED | Authenticated employee list returns limited photo URL | Decide whether employee photos should become private in a later policy change |
| Branding logos, dashboard images, PDF stamps/QR files | PUBLIC | Public branding/settings paths can use these | Keep only intentional branding assets public |
| Manual email/WhatsApp attachments | MIXED | Upload content is validated; outbound fetch/local paths are constrained | Avoid storing private documents in public upload categories |

## Document share regression plan

Run these in staging with provider calls stubbed or sandboxed first, then with real provider test recipients:

| Flow | Required checks |
|---|---|
| Invoice PDF sharing | Generated URL opens only the invoice PDF, expires, and fails on another invoice path. |
| Quotation PDF sharing | Quotation PDF attachment is generated from server data; no arbitrary local/remote image path is accepted. |
| Contract PDF and job-card summary | Contract/job-card PDF is available to legitimate customer delivery paths and not anonymously reusable for other records. |
| Job card sharing | Technician can share only assigned job-card document; token cannot access directories or become a login token. |
| Salary slip sharing | HR/admin can share; employee/token can access only the bound slip path until expiry. |
| Renewal PDF sharing | Renewal attachment still renders and honors customer recipient data from the record. |
| WhatsApp attachment sharing | Recipient phone comes from current record/audience source, attachment URL is HTTPS or server-generated. |
| Email attachment sharing | Local attachments are read only from approved upload roots and passed as bounded buffers. |

## Dependency evaluation

Nodemailer, googleapis, and react-router upgrades are release blockers only after staging proves compatibility. Do not combine these majors with unrelated hardening. Use a temporary branch/worktree, run the existing security test suite and frontend build, then perform sandbox SMTP/OAuth/Tasks/browser-routing checks without real customer sends.

## Hostinger operator checklist

1. Configure environment outside Git: `NODE_ENV=production`, strong `PORTAL_AUTH_SECRET`, `SERVER_ORIGIN`, CORS origins, encryption keys, and exact proxy trust for Hostinger.
2. Rotate exposed database, admin, WhatsApp, SMTP/API tokens as applicable; never roll back to old values.
3. Ensure Node serves `/uploads` and private categories are not reachable through public_html, static aliases, CDN, backups, or upload mirrors.
4. Keep runtime data and uploads on private persistent storage outside the release directory; use restrictive file permissions such as directories `0750` and files `0640` or tighter.
5. Align Hostinger headers with Node: CSP must allow required CRM/Maps/PDF flows; Permissions-Policy must allow `geolocation=(self)` and keep camera/microphone disabled.
6. Enforce HTTPS and verify secure cookies with the actual CRM/API host relationship.
7. Restrict the runtime database user to the narrowest tested grants after startup migration/table-creation behavior is refactored or explicitly accepted.
8. Back up MySQL and runtime JSON/uploads before password migration, upload relocation, or dependency-major testing.
9. Restart Node after environment changes and verify `/api/health`, login, attendance GPS, PDFs, WhatsApp, email, Google integrations, and private uploads.

## Staging regression plan

Run role-based browser/API checks for Admin, Sales, Sales Person, Operations, HR, Technician, and any custom role found in employees. Cover admin login, sales login, technician login, attendance GPS, customer, lead, contract, invoice, quotation, payroll, job, renewal, WhatsApp, WhatsApp Marketing, email, PDF downloads, and Google integrations.

Security checks must include unauthenticated access, cross-role access, IDOR by manually changing IDs, private file access, CSRF, CORS, rate limiting, upload validation, SSRF attempts, and response secret leakage. Use restored disposable data first; production remains off-limits for destructive requests.

## Final Phase 2 status

CRITICAL BLOCKERS REMAINING: credential rotation, history/cache/backups handling, and Hostinger/private-file verification.

HIGH BLOCKERS REMAINING: full Sales/Operations/HR/payroll ownership enforcement, dependency-major regression, complete document-delivery regression, full accounting recomputation, and remaining structured log redaction.

OPERATOR ACTIONS: rotate secrets, verify Hostinger routing/headers/permissions, run private-upload checker after deployment, back up before password migration, and perform staging browser/provider tests.

STAGING STATUS: READY FOR STAGING after this patch is built and deployed to a non-production environment with disposable/restored data.

PRODUCTION STATUS: NOT READY.
