# SKUAS CRM security audit and hardening

Audit date: 2026-09-10. Scope: this working checkout, handwritten backend/frontend source, deployment files, tracked configuration/runtime data, dependency audits, isolated regression tests, and one read-only production homepage HEAD request. OWASP Top 10 used as the baseline.

**Production Security Status: NOT READY.** This is a hardening patch with verified controls, not a certification that every business workflow or route is secure. No deployment, push, production attack, database connection, migration, credential rotation, or upload relocation was performed. The ordinary application was not started: importing/starting it can run migrations, backfills, synchronization, and campaign schedulers.

## A. Executive summary

Four critical finding groups were confirmed: committed credentials, publicly returned administrator credentials, public sensitive uploads, and payroll PDF access based on caller-supplied identity. Code and repository fixes address their application paths, but credential rotation, history handling, and Hostinger static routing remain mandatory.

High findings include missing role/ownership enforcement, plaintext password storage, upload extension/MIME bypasses, unrestricted server fetches and local PDF asset paths, and marketing recipient/opt-out bypass. Medium findings include cookie CSRF exposure, limited brute-force controls, weak CSP, input/error handling, host-derived URLs, CSV formula injection, and resource-limit gaps. Low/info findings include repository dependency artifacts and deployment-policy inconsistencies.

The remaining release blockers are listed in Q and the final decision. Some broad requirements remain incomplete: durable session revocation, complete sales/operations permissions, full financial validation, bounded legacy lists/import parsing, all logging paths, and real database/browser integration coverage. These are explicitly not reported as fixed.

## B. Vulnerability table

| ID | Severity | Issue / risk | Affected files and endpoints | Fix applied | Verification / residual |
|---|---|---|---|---|---|
| C1 | CRITICAL | Credentials committed to Git; checkout/history access compromises database and messaging credentials | `backend/.env` lines 7 and 13: database password variables; `storage/data/settings.json`: adminPassword and whatsappAccessToken fields | Untracked live env/runtime data while preserving local files; ignore rules added | Index no longer contains these paths. History still contains them. Rotate before release; no values reproduced |
| C2 | CRITICAL | Unauthenticated caller could retrieve admin password from settings | `server.js`: `maskClientSettings`, GET `/api/public/settings`; GET `/api/settings` also returned it | Public branding allowlist; recursive credential omission for JSON responses; frontend no longer compares against a downloaded password | Middleware response tests; source review. Existing browser caches/backups may still contain old values |
| C3 | CRITICAL | Aadhaar/PAN/employee documents and salary slip files served publicly | `server.js` static `/uploads`; `payrollModule.js` generated upload paths | Authentication plus HR/admin authorization on private upload categories; private/no-store and attachment headers | Anonymous 401, technician 403, admin allowed in local tests. Direct Hostinger aliases/mirrors not verified |
| C4 | CRITICAL | Payroll PDF auth exemption plus query-based role/user identity | GET `/api/payroll/items/:id/slip/pdf`; `portalPublicRoutePatterns`; payroll/HR identity helpers | Removed PDF exemptions and query identity fallbacks; authenticated ownership retained; narrowly scoped expiring document shares added | Anonymous `?role=Admin` denied; share token cannot authorize another path or become a session |
| H1 | HIGH | Authenticated non-admin could modify security/settings and employee roles | `/api/settings*`, `/api/employees*`, Google integration, upload deletion | Server admin checks for settings mutations/Google integration/delete; HR/admin employee mutations; known settings keys enforced | Unauthorized settings/role writes denied. Broader role model still needs review |
| H2 | HIGH | Technician can change another job or attendance identity, read HR/GPS data | `/api/jobs*`, `/api/service-visits*`, `/api/attendance*`, `/api/technicians*`, `/api/employees` | Assigned-job checks, technician update-field allowlist, scoped lists, attendance identity enforcement, GPS identity overwrite/range checks, HR/GPS access gates | Tests cover other-job denial, allowed own-job updates, mixed-case IDs, other attendance ID, location history, own GPS route and employee privacy. Full MySQL handlers not integration-tested |
| H3 | HIGH | Passwords stored and compared as plaintext; default admin password | Login/settings/reset/employee writes; `portalAuth.js`, `passwords.js`, Settings UI | Removed server default; async salted scrypt for new/changed passwords; verify current password on server; preserve blank employee-password edits; reject short auth secret | Hash and legacy verification tests. Existing plaintext records are not migrated; legacy verification remains intentionally supported pending backup/migration |
| H4 | HIGH | Image filter used extension OR claimed MIME, permitting executable filenames | Multer filters in `server.js`; email/WhatsApp uploads; customer imports | Require allowed extension AND MIME; validate common file signatures after disk write, remove invalid files; random filenames; size bounds; signature data URLs restricted | Executable, mismatched MIME, oversized, and spoofed content tests. Signature checking is not antivirus or full image decoding; HEIC/HEIF retained |
| H5 | HIGH | SSRF through arbitrary PDF images, permissive Maps expansion, provider/attachment requests | `server.js` PDF logo and Maps helpers; `googleMapsResolve.js`; email/WhatsApp services | HTTPS only, reject private/special IPs, validate DNS and pin connection address, block automatic redirects, bounded response size/time; Maps host allowlist | Unsafe scheme/address tests; no live provider calls. SMTP network destinations and all third-party SDK traffic need separate deployment egress controls |
| H6 | HIGH | Arbitrary local image/file paths used by PDF helpers and email attachments | `quotationPdf.js`, `invoicePdf.js`, `server.js` logo resolver; `email.service.js` | Canonical upload-root containment including symlinks; remove arbitrary filesystem fallbacks; user attachment URLs require HTTPS; trusted local mail attachments converted to bounded buffers | Traversal/symlink tests; source review. Existing upload roots and mirrors require operator verification |
| H7 | HIGH | Campaign can accept injected phone/status and bypass opt-out; existing lock IDs could escape lock directory | `whatsappMarketing.controller.js` campaign creation/worker | Recipient selection resolved from authoritative audience; recheck eligibility/phone before each send; generate campaign IDs; hash lock filenames | Stubbed-sender regression: injected phone ignored and subsequent opt-out prevents sending. JSON customer mirror freshness remains a concern |
| M1 | MEDIUM | Cookie-authenticated mutations lacked CSRF validation | Global API middleware/login | Require trusted Origin or Referer for cookie writes and login; public website origins excluded from mutation trust | Same-site public website origin denied; trusted CRM origin allowed. Bearer-only calls do not rely on ambient cookies |
| M2 | MEDIUM | Login/public lead/marketing abuse; IPv6 limiter key issue | Global middleware and sensitive routes | Login 10 attempts/15 minutes per IP with successful requests skipped; lead 15/15 minutes; messaging 40/minute; existing category/global limits retained; use library IP handling | Local rate-limit tests. Counters are process-local, no distributed account-level backoff |
| M3 | MEDIUM | CSP disabled; geolocation denied by security policy | `server.js` Helmet/security headers | CSP with self defaults and Maps/fonts/API allowlists; no unsafe-eval; self geolocation; HSTS only in production | Production-mode middleware tests. Live Hostinger headers differ; see M |
| M4 | MEDIUM | Internal errors, secrets, unbounded pagination/prototype keys | `security.js`, global JSON/error handlers | Generic 5xx JSON, recursive credential omission, dangerous-key/depth checks, page-size rejection over 500, bounded lead fields, 2 MB JSON body | Error, pollution, pagination, lead tests. Several legacy list queries remain unbounded and raw server logs remain a residual |
| M5 | MEDIUM | Untrusted Host/proxy headers in generated URLs; unconstrained OAuth redirect suffix | `server.js`, `quotation.routes.js`, Google OAuth start | Configured server origin / fixed deployment default; OAuth returns to `/settings`; proxy trust configurable and defaults to loopback | Source review. Hostinger must set its real proxy trust configuration |
| M6 | MEDIUM | Invalid/negative/non-finite payment input and CSV formula execution | Payment writes; payroll/customer/stock CSV helpers | Payment amount positive decimal, two fraction digits, upper bound; formula/control-prefix escaping in CSV exports | Payment tests; CSV source review. Invoice/GST/payroll total recomputation still needs work |
| M7 | MEDIUM | Malformed/non-expiring custom session tokens accepted; malformed cookie decoding throws | `portalAuth.js` | Require integer expiry/issued-at/identity, exact two token parts, bound token size, tolerant cookie decoding | Expired/missing expiry/tampered/wrong-secret/extra-part/cookie tests. Logout still only clears browser cookie |
| D1 | HIGH/MEDIUM | Vulnerable dependencies | Backend and frontend lockfiles | Compatible `npm audit fix --ignore-scripts`, never `--force` | Backend 9 → 5 advisories; frontend 11 → 2. See N; unaccepted remaining high risk |
| I1 | INFO | Installed dependencies and private runtime files tracked despite ignore rules | Git index | Removed tracking, kept local copies; retained package manifests/lockfiles | Large staged removal is intentional. No commit or push |

## C. Files changed

Application changes: `backend/server.js`, `backend/lib/portalAuth.js`, new `backend/lib/security.js`, `backend/lib/passwords.js`, `backend/lib/safeFetch.js`, `backend/lib/documentShares.js`, `backend/lib/googleMapsResolve.js`, `backend/invoicePdf.js`, `backend/quotationPdf.js`, `backend/payrollModule.js`, `backend/hrModule.js`, `backend/customerDedupModule.js`, `backend/controllers/whatsappMarketing.controller.js`, email/WhatsApp/quotation/stock route files, email/WhatsApp service files, `backend/package.json`, backend/frontend lockfiles, `frontend/src/components/Settings.jsx`, `frontend/src/components/TechnicianPortal.jsx`, `.gitignore`, tests, and this report/evidence directory.

The frontend's existing build script copies `frontend/dist` into `backend/public`; production-build verification therefore refreshed local fallback bundles. Existing unrelated work in App/WhatsApp Marketing/routes/audience service and previously generated assets was preserved. The campaign controller and server already had user edits; security changes were layered onto them.

Staged hygiene removals: tracked `backend/node_modules`/`frontend/node_modules` if present, `backend/.env`, `frontend/.env.production`, and tracked `storage/data` files. Files remain on disk; this is **not deletion of operational data**. Deployment must install dependencies and configure environment/runtime persistence explicitly. `working-tree-files.txt` is a tracked-path inventory including pre-existing edits, generated files, and hygiene removals; it is not a claim that every listed change originated in this audit.

## D–E. Middleware and authorization

The actual Express middleware prefix is exercised in an isolated VM using Express/Helmet/CORS/rate-limit packages, with business data supplied as fixtures. Database imports, dotenv, startup tasks and schedulers are excluded.

Private APIs require authenticated sessions. Specific admin, employee HR, technician ownership, attendance and campaign checks execute before handlers and uploads. HR/payroll identity helpers no longer trust query/body identity overrides. Technician directory output contains a small identity/display allowlist; associated customer/invoice/schedule lists are filtered by assigned job references. Technician direct customer/invoice child routes are denied; assigned-job flows are the supported access path.

These changes do not constitute a complete role matrix: Sales/Sales Person/Operations still have broad access in legacy handlers, and further read/write ownership and HR/payroll data minimization review is required. Unknown or custom employee-role behavior requires staging review. PDF/HR security changes will intentionally reject requests that previously worked only because authorization was absent.

Document-sharing tokens are separate from login tokens, path-bound, valid one hour, and read-only. Payroll WhatsApp sharing and technician job-card email use these grants. They are bearer capabilities: anyone receiving the complete URL can read that one document until expiry. Existing old unsigned links no longer bypass authentication; generate fresh links. Other historical invoice/contract external sharing workflows need a staging regression check. No file relocation or auth database migration was executed.

## F. SQL injection

No confirmed request-value SQL injection was established in reviewed handwritten queries. Observed values use MySQL placeholders. The dynamic templates contain server-defined table names, schema-derived/explicit column sets, placeholder lists, and fixed conditional fragments. `sql-interpolation-inventory.json` records 53 template locations; the scanner is a review aid and does not parse every nested JavaScript template or prove absence of injection. HR helper callers use fixed table literals; payroll helpers are internal.

There are more important unresolved data-integrity issues: some HR/payroll synchronization helpers replace table contents and startup code runs migrations/backfills. These were not executed or rewritten. Moving schema changes to a migration account is recommended. No database permissions were changed.

## G. XSS, URLs and redirects

Search of `frontend/src` found no `dangerouslySetInnerHTML`, `.innerHTML`, `document.write`, or `srcDoc` sinks. Normal React text rendering provides escaping. Email templates intentionally produce HTML; that content was not claimed to be sanitized or tested in email clients. Template variables, arbitrary link fields, and older prebuilt bundles still need full browser/content-flow regression coverage.

CSP limits script sources without unsafe-eval; inline styles remain allowed because the CRM uses them extensively. Upload signature/extension checks reduce active-content hosting. OAuth redirect is fixed to settings. Browser Maps keys are public by design, and the public endpoint now reads only GOOGLE_MAPS_BROWSER_API_KEY or VITE_GOOGLE_MAPS_API_KEY. Server geocoding keys are no longer returned. Configure a separately browser-restricted key before rollout to retain Maps functionality.

## H–I. Uploads and private documents

Multer size limits are retained (5 MB employee photo, 8 MB ordinary/document/attachment uploads, 20 MB imports). Image/document signature checks cover JPEG, PNG, WebP, HEIC/HEIF, PDF, XLS/ZIP-based XLSX and basic CSV binary rejection. This does not validate archive contents, detect zip bombs or malware, or re-encode images. Content verification occurs after disk write and before application handling; invalid files are removed. Random names replace timestamp-only naming.

Protected categories are employee Aadhaar/PAN/documents, payroll/salary slips, and imports. Public branding and deliberately shared documents continue to use existing uploads. Existing private files are not moved. Hostinger may serve or mirror these paths without Node: verify every alias, public_html copy, CDN and backup. No claim is made that live sensitive files are currently inaccessible.

## J. Secret exposure and environment

Only secret types, paths and variable names were recorded. Git history shows multiple commits touching the exposed files; a history rewrite was not performed. Untracking alone does not revoke credentials or erase history. Rotate database passwords, administrator password and WhatsApp token, examine access logs, and rotate other credentials sharing those values. Rotate portal signing secrets after deployment to invalidate old sessions. SMTP/password/token fields are omitted from ordinary JSON responses.

New/changed passwords use salted asynchronous scrypt (N=32768, r=8, p=3, 32-byte output), an OWASP-listed configuration. Existing legacy plaintext remains valid until explicitly migrated or changed. Take encrypted database and runtime-data backups, perform a dry-run inventory of legacy password fields/aliases, then migrate with transaction/rollback and sign-in tests; do not simply remove legacy verification first. This audit did not run that migration.

Browser-cached settings, Git history, old artifacts, logs, exports and backups may still contain previously exposed values. Restrict and clean them through a coordinated incident response. Secret scans here are targeted source/config/index/history-path checks, not a complete entropy scan of every historical blob.

## K–L. Rate limits, CORS and CSRF

Rate limits: normal API 240/minute; sensitive paths 10/15 minutes; login 10 failed attempts/15 minutes per IP; public leads 15/15 minutes; WhatsApp/email/marketing categories 40/minute. Successful login requests do not count toward the login limiter. These process-local counters reset on restart and multiply across replicas; a shared limiter and account-aware timed backoff remain outstanding. Bulk execution itself also has existing batch/delay controls.

CORS uses exact validated origins and credentials, never a wildcard/reflected arbitrary origin. Localhost defaults are development-only. Cookie writes and login require an allowed Origin or Referer; the public website origins are not trusted for authenticated mutations. Header-only bearer requests without cookies are not subject to cookie CSRF validation. `HttpOnly`, `Secure` in production and `SameSite=Lax` remain enabled; cookies default to host-only. Cross-host deployment behavior must be tested.

The website lead endpoint remains intentionally public and optional-key authenticated for compatibility with website forms. Its new field/body/rate bounds do not replace bot detection. If the endpoint is intended to require a server-to-server secret, that contract still needs tightening; do not place that secret in public website JavaScript.

## M. Security headers: actual live response

One HTTPS HEAD request to `https://crm.skuaspestcontrol.com` returned HTTP/2 200:

```text
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: upgrade-insecure-requests
```

This is the current deployment, **not the un-deployed patch**. Raw selected headers are in `production-headers.txt`; cookies were not recorded. Local production-mode middleware tests confirm CSP, HSTS, nosniff, referrer/permissions and frame headers. The new CSP includes self, Maps/Places/googleapis, maps.gstatic.com, fonts.googleapis.com/fonts.gstatic.com, configured SKUAS API origin, HTTPS images, and blob PDF frames. Inline styles remain required. Hostinger must align header policies and route them consistently; its current geolocation restriction blocks attendance GPS even if Node allows it. Custom API origins, Firebase features, remote fonts, PDF embeds and Maps require browser smoke tests before enforcing this in production.

HTTPS redirect/enforcement and exact trusted proxy ranges are Hostinger tasks. HSTS is production-only in the patch; do not assume a numeric trust-proxy hop is safe on every ingress path.

## N. Dependencies

Both requested npm audits ran against the registry. Network permission was used after the sandbox DNS request failed. Updates used `npm audit fix --ignore-scripts`; no forced major changes or install scripts ran.

| Workspace | Before | After compatible fixes |
|---|---|---|
| Backend | 3 high, 5 moderate, 1 low | 1 high, 4 moderate |
| Frontend | 1 critical, 7 high, 3 moderate | 2 moderate |

Remaining backend packages: Nodemailer (high), and googleapis → googleapis-common/gaxios → uuid (moderate chain). Nodemailer is actively used for SMTP; the patch restricts addresses/headers, omits raw/stream attachment options and supplies bounded buffers, reducing specific attack paths. This is not proof every advisory is unreachable. npm proposes Nodemailer 10.0.3 and Google APIs 178.0.0, both major upgrades requiring service regression testing. The uuid bounds issue concerns supplied output buffers; no direct application use of that API was found.

Remaining frontend packages: react-router and react-router-dom (moderate). This app uses browser routing, not SSR hydration, so the SSR-specific advisory has reduced relevance; backslash/open-redirect behavior still needs validation. npm proposes react-router-dom 7.18.3, a major upgrade. These are unresolved risks, not silently accepted exceptions.

Detailed registry advisory titles, URLs and fix metadata are in `backend-npm-audit.json` and `frontend-npm-audit.json`. Earlier compatible fixes included upload/parser/network/frontend dependency updates; inspect lockfiles for exact versions. Builds passed with those versions. Root package and external Hostinger/runtime software were not separately certified by these two audits.

## O. Verification and limits

- Backend syntax: 43 handwritten/test JavaScript files checked, zero syntax failures at the recorded run.
- Frontend `npm run build`: passed; its existing script refreshed backend/public fallback assets.
- `git diff --check` and `git diff --cached --check`: passed.
- Isolated security tests: 28 passed, zero failed; see `security-tests.tap` for the final result. Coverage includes auth/role denial, own-job compatibility, attendance/GPS gates, directory minimization, private files, CSRF/CORS, limits, errors, session signatures, password hashes, outbound restrictions, traversal/symlinks, upload content/size/MIME, payment inputs, document capabilities and campaign opt-out.
- No destructive production requests, test messages, email sends, database writes or migrations. The campaign test uses a stubbed sender and temporary files.

The tests exercise actual middleware with fixture handlers and selected real helper/controller functions. They do **not** prove all MySQL query results, ownership aliases, session lifecycle, browser views, printing, Imports, Maps/OAuth, SMTP or WhatsApp provider compatibility. A restored disposable database and staging browser suite remain required. `route-inventory.txt` records route/middleware registration sites for follow-up; entries alone do not prove full per-route semantic review.

## P. Hostinger and backup actions

1. Rotate exposed credentials; audit access to Git/backups and coordinate historical-secret removal. Do not rewrite shared history without team coordination.
2. Configure production environment outside Git: NODE_ENV, strong portal secret, canonical SERVER_ORIGIN, separate encryption keys, required API origins, and exact proxy trust. See `hostinger.env.example`; it contains no operational credentials.
3. Route private uploads to Node authentication. Remove direct web-server/CDN/static aliases and public mirrors for private categories; inspect public_html and all copies. A deny rule on static delivery alone must not also block the authorized Node download path.
4. Keep uploads/runtime data on private persistent storage outside release directories/public_html. Suggested permissions: directories 0700/0750, files 0600/0640 under the application service account; never 0777. Restrict backups with encryption/access controls and test restores.
5. Reconcile Hostinger CSP/permissions headers with Node, permit required self geolocation, enforce HTTPS at ingress, and verify browser PDF/Maps/OAuth flows. Configure secure cookies for the actual API/CRM host relationship.
6. Database account: normal app operations should use the narrowest necessary SELECT/INSERT/UPDATE/DELETE grants on its own schema; separate migrations under a controlled DDL account. Do not grant GRANT/SUPER or unrelated schema access. Current runtime auto-migrations/per-route table creation prevent blindly removing DDL privileges; refactor/test before reducing them. No privileges changed here.
7. Before password migration, upload moves, role tightening or dependency majors, back up DB plus runtime JSON/private files and preserve manifests/lockfiles. Test migration and rollback on a restore. Never roll back to exposed credentials; rollback code/data while keeping rotated secrets and private routing.
8. Deployment must install from lockfiles (`npm ci` in each workspace with appropriate dev/build stages) because installed dependency files are no longer tracked. Preserve local runtime data when releasing. This patch was not deployed.

## Q. Remaining risks and exact release blockers

**Critical blockers:** rotate committed/exposed credentials; verify that no sensitive upload is reachable through direct Hostinger aliases/mirrors/backups; handle previously exposed caches/history.

**High blockers:** legacy plaintext passwords still need migration; logout/password reset/employee disable do not durably revoke existing stolen sessions before expiry; complete and test Sales/Operations/HR/payroll route permissions and record ownership; verify all message recipient/document sharing workflows after authorization changes; resolve or formally assess the active Nodemailer high advisory with tested service upgrades.

**Additional unfinished hardening:** server-side invoice/tax/discount/payroll calculations and field schemas are not comprehensively validated; numerous list endpoints still load whole tables; imports lack decompression/row/cell caps and malware scanning; production logs may contain unredacted detailed errors/PII outside the new response guard; JSON mirrors used for marketing consent need freshness guarantees; optional website-lead key behavior and anti-bot policy need an explicit contract; runtime DB writes on GET/startup need separate review; provider/SDK/SMTP egress and DNS timeout behavior need deployment constraints; cookie/domain/CSP changes need real browser tests; remaining router/Google dependency upgrades require staged regression tests.

No optional Security Settings UI was added, avoiding unnecessary product changes. No security claim is inferred from hiding frontend controls.

## References

The password KDF parameters follow the [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Origin validation follows the [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Outbound address/redirect controls were checked against the [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). Dependency-specific advisory sources are embedded in the npm audit artifacts.

**Production Security Status: NOT READY.** The critical operational blockers, unfinished authorization/session/password work, dependency risk, and missing staging/database/browser verification above must be closed before a production go decision.
