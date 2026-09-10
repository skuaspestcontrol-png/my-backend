# SKUAS CRM phase 3 staging security verification

Date: 2026-09-10. Scope: prepare and run staging-only verification for the Phase 1 and Phase 2 security changes. No production deployment, production writes, destructive migrations, secret rotation, bulk campaign send, commit, or push was performed.

## Staging deployment check

Status: NOT EXECUTED.

No staging URL, staging environment variables, role credentials, disposable MySQL database, or provider sandbox credentials were present in the workspace. The current patch is staged in Git and can be deployed to a non-production environment. It must not be pointed at production data while validating startup, migrations, backfills, schedulers, email, WhatsApp, or Google integrations.

Use:

```bash
cd backend
STAGING_BASE_URL=https://staging.example.com npm run security:staging
```

Optional role credentials:

```bash
STAGING_ADMIN_USERNAME=...
STAGING_ADMIN_PASSWORD=...
STAGING_SALES_USERNAME=...
STAGING_SALES_PASSWORD=...
STAGING_SALES_PERSON_USERNAME=...
STAGING_SALES_PERSON_PASSWORD=...
STAGING_OPERATIONS_USERNAME=...
STAGING_OPERATIONS_PASSWORD=...
STAGING_HR_USERNAME=...
STAGING_HR_PASSWORD=...
STAGING_TECHNICIAN_USERNAME=...
STAGING_TECHNICIAN_PASSWORD=...
STAGING_PRIVATE_UPLOAD_PATHS=/uploads/employees/aadhaar/test.pdf,/uploads/employees/pan/test.pdf
npm run security:staging
```

The script writes a redacted report to `docs/security/staging-verification-results.json` unless `STAGING_SECURITY_REPORT` is set.

## Local verification completed

| Check | Result | Evidence |
|---|---|---|
| Backend security regression suite | PASS | `docs/security/security-tests.tap`: 30 passed, 0 failed |
| Backend syntax checks | PASS | `docs/security/syntax-check.txt` |
| Password migration dry-run | PASS | `docs/security/password-migration-dry-run.json`; count/ID metadata only |
| Git whitespace checks | PASS | `git diff --check` and `git diff --cached --check` passed |
| Staging URL/config | NOT AVAILABLE | No real staging endpoint was supplied |
| MySQL staging connection | NOT EXECUTED | No disposable staging DB config was supplied |
| Browser/CSP/GPS smoke test | NOT EXECUTED | Requires staging URL and browser session |
| Email/WhatsApp provider regression | NOT EXECUTED | Requires test recipient/provider sandbox; no real sends were made |

## Authentication tests

Local automated coverage confirms token format hardening, expiry validation, malformed cookie tolerance, logout/session-version revocation helper behavior, and employee/admin password hashing. Real staging must still verify:

| Scenario | Staging status |
|---|---|
| Admin login | PENDING |
| Sales login | PENDING |
| Sales Person login | PENDING |
| Operations login | PENDING |
| HR login | PENDING |
| Technician login | PENDING |
| Invalid login rejection | Covered locally; PENDING in staging |
| Session expiry | Covered locally at token level; PENDING in staging |
| Logout revokes old session | Covered locally; PENDING in staging |
| Password change invalidates old session | Code path added; PENDING in staging |
| Disabled/deleted employee session invalidates | Code path added; PENDING in staging |

## Role and ownership verification

Status: PARTIALLY VERIFIED LOCALLY, PENDING IN REAL STAGING.

Local tests cover unauthenticated denial, admin/settings restrictions, employee role mutation denial, technician assigned-job ownership, technician cross-job denial, technician attendance/GPS limits, HR/private upload gating, marketing role denial, and employee directory minimization.

Real staging must still record allowed/denied results for Admin, Sales, Sales Person, Operations, HR, Technician, and custom roles across Customers, Leads, Contracts, Invoices, Payments, Jobs, Renewals, Attendance, Employees, Payroll, HR, Stock, WhatsApp, WhatsApp Marketing, and Email. Sales/Sales Person/Operations ownership remains the largest production blocker because those business rules require real data relationships.

## IDOR tests

Status: PARTIALLY VERIFIED LOCALLY, PENDING IN REAL STAGING.

Local tests cover technician cross-job denial and cross-employee attendance denial. Staging must manually change IDs for:

| Endpoint | Expected |
|---|---|
| `/api/customers/:id` | Unauthorized cross-owner access returns 401/403/404 |
| `/api/contracts/:id` | Unauthorized cross-owner access returns 401/403/404 |
| `/api/invoices/:id` | Unauthorized cross-owner access returns 401/403/404 |
| `/api/jobs/:id` | Technician other-job access returns 403/404 |
| `/api/attendance/:id` | Non-HR cross-employee access returns 403/404 |
| `/api/employees/:id` | Non-HR writes denied; non-HR sensitive reads denied |
| `/api/payroll/:id` | Non-HR/non-owner access denied |

## Private upload test

Status: TOOL READY, PENDING AGAINST STAGING.

Run both:

```bash
cd backend
STAGING_BASE_URL=https://staging.example.com npm run security:check-private-uploads
STAGING_BASE_URL=https://staging.example.com STAGING_PRIVATE_UPLOAD_PATHS=/uploads/employees/aadhaar/test.pdf,/uploads/payroll/salary-slips/test.pdf npm run security:staging
```

Anonymous access to Aadhaar, PAN, employee documents, salary slips, HR documents, imports, public_html mirrors, `/static`, `/uploads`, storage mirrors, CDN URLs, and direct file URLs must be denied. If any private file opens anonymously, production status is a CRITICAL BLOCKER.

## Document delivery regression

Status: PENDING IN STAGING.

Test CRM view, download, new-tab open, email attachment, and WhatsApp attachment for Invoice PDF, Quotation PDF, Contract PDF, Job Card, Renewal Letter, and Salary Slip. Share tokens must expire, be path/document specific, fail for another document, fail for directory paths, and fail as login/session tokens.

## WhatsApp regression

Status: PENDING IN STAGING.

Use one controlled test number only. Verify test connection, invoice text, invoice PDF, quotation, contract-linked invoice, job card, renewal, and one test marketing send. Confirm templates render, access token is never returned to the frontend, phone normalization works, provider errors are mapped, logs are redacted, `templateKey` is logged, and opt-out is respected. Do not run a bulk live campaign.

## WhatsApp Marketing security

Status: PARTIALLY VERIFIED LOCALLY, PENDING IN STAGING.

Local tests confirm injected frontend phone is ignored, opt-out is rechecked before send, and unauthorized roles cannot execute campaigns. Staging must add duplicate, invalid, opted-out, and status-changed test records, then verify pause/resume does not resend sent recipients.

## Email regression

Status: PARTIALLY VERIFIED LOCALLY, PENDING IN STAGING.

Code review and local tests cover bounded local attachment paths and header/recipient checks. Staging must use a test SMTP account or safe recipient for invoice, quotation, job card, and renewal emails. SMTP password must not reach the browser, arbitrary local file paths must fail, header injection must fail, attachments must be bounded, and failures must not expose credentials.

## GPS, CSP, CORS, CSRF, rate limit, upload and import checks

Status: PARTIALLY VERIFIED LOCALLY, PENDING IN BROWSER/STAGING.

Local tests cover CORS denial, cookie-origin CSRF denial, upload MIME/content/size rejection, SSRF restrictions, rate-limit behavior, and import shape limits. Staging browser checks must confirm attendance GPS prompt/capture on punch-in and punch-out, no CSP console violations for required CRM flows, allowed CRM origin works, untrusted origin fails, normal usage is not blocked by rate limits, and valid uploads/imports still work.

## MySQL password migration dry-run

Status: NOT EXECUTED.

Only run this against a restored disposable/staging database:

```bash
cd backend
node scripts/password-security-migration.js --dry-run --mysql
```

Expected output is count/ID metadata only. It must detect already-hashed, legacy plaintext, and invalid/missing records without changing data.

## Dependency regression branch

Status: NOT EXECUTED.

The main worktree contains staged security changes, so dependency-major testing should be done in a temporary branch/worktree after this staged patch is committed locally or copied into an isolated checkout. Test Nodemailer, googleapis, and react-router/react-router-dom separately. Do not combine all major upgrades. Do not send real emails or connect OAuth to production credentials.

## Secret rotation plan

| Secret | Where to change | Environment/runtime update | Restart? | Post-change test |
|---|---|---|---|---|
| Database password | Hostinger/MySQL control panel | Backend MySQL env vars | Yes | `/api/health`, DB-backed list read, login |
| Admin password | CRM settings or password migration flow after backup | Runtime settings store | Session revocation happens in app; restart not usually required | Admin login, old session rejected |
| WhatsApp token | Meta/Deropo/provider console | Runtime settings/env depending provider config | Usually yes if env-backed | Test connection and one test send |
| Portal/session signing secret | Hostinger Node env | `PORTAL_AUTH_SECRET` | Yes | All old sessions invalid, all roles can log in |
| SMTP password | SMTP provider/Hostinger mail | Runtime settings/env | Yes if env-backed | Test SMTP and one safe email |
| Google/server credentials | Google Cloud Console | Env/integration store | Yes for env-backed values | OAuth callback, Tasks sync, Maps server use if enabled |

## Production go/no-go matrix

| Requirement | Status | Evidence | Blocking? | Operator action |
|---|---|---|---|---|
| Credential rotation | PENDING | No rotation performed | Yes | Rotate all exposed/reused secrets |
| Git history handling | PENDING | Report identifies historical exposure | Yes | Coordinate history/cache/backups cleanup |
| Private upload verification | PENDING | Tool created, not run on staging | Yes | Verify Node and Hostinger routing |
| Authorization matrix | PARTIAL | Local tests and Phase 2 matrix | Yes | Complete staging role/IDOR results |
| Session revocation | PASS LOCALLY | 30-test suite | No, pending staging proof | Verify in staging |
| Password migration | DRY-RUN READY | JSON dry-run evidence | Warning | Run staging MySQL dry-run, then planned apply after backup |
| Document sharing | PARTIAL | Token tests local | Yes | Run provider/document staging regression |
| WhatsApp | PARTIAL | Local marketing security tests | Yes | Test controlled number only |
| Email | PARTIAL | Code controls local | Yes | Test SMTP sandbox/safe recipient |
| GPS | PENDING | Node header allows self | Yes | Fix Hostinger header and browser-test attendance |
| CSP | PENDING | Local headers pass; live old header differs | Warning | Browser console smoke test |
| Dependencies | PENDING | Advisories documented | Yes | Separate major-upgrade regression branches |
| Financial validation | PARTIAL | Local malformed payload tests | Warning | Verify normal staging transactions |
| Logs | PARTIAL | Response/log plan exists | Warning | Inspect staging logs after tests |
| Backups | PENDING | Operator checklist exists | Yes before migration | Back up DB/runtime/uploads |

## Final report

A. STAGING TEST RESULT: FAIL, because no real staging environment was available to test. Local/pre-staging verification passed.

B. TESTS PASSED: backend security regression suite, syntax checks, password dry-run safety, whitespace checks.

C. TESTS FAILED: no local automated failures. Staging live checks are pending, not passed.

D. SECURITY REGRESSIONS FOUND: none in local regression tests. Live staging may reveal CSP, Hostinger routing, provider, or role-ownership gaps.

E. CRITICAL BLOCKERS: credential rotation, Git/history/cache/backups cleanup, and private upload verification through Hostinger/public_html/CDN/static paths.

F. HIGH BLOCKERS: full Sales/Sales Person/Operations ownership verification, document delivery regression, WhatsApp/email provider regression, dependency-major testing, staging log review, and MySQL password migration dry-run.

G. HOSTINGER ACTIONS: deploy only to non-production first, configure production-like env with staging secrets, verify Node routing for uploads, remove private static aliases/mirrors, set `geolocation=(self)`, test HTTPS/proxy/CSP/cookies, and inspect public_html/CDN/backups.

H. CREDENTIAL ROTATION ACTIONS: rotate database, admin, WhatsApp, portal signing secret, SMTP if exposed/reused, and Google/server credentials if exposed/reused. Restart env-backed services and test each affected feature.

I. PASSWORD MIGRATION READINESS: JSON dry-run works and prints no password values. MySQL dry-run must be run only against staging/restored disposable DB before any apply.

J. DEPENDENCY UPGRADE RESULTS: not executed. Test Nodemailer, googleapis, and react-router majors separately in isolated branches/worktrees.

K. PRODUCTION DECISION: NOT READY.
