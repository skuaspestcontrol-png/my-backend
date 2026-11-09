# Service Reports — Phase 2 local implementation

Phase 2 covers the CRM/ERP backend and React portal only. No Sales App or Sales API changes, production connections, deployments, commits, pushes or production migrations are part of this work.

## User workflow

Open **Operations → Field Operations → Service Reports**. Navigation is visible to staff with `view`; existing authenticated administrators retain management access. Create an inspection/service draft, select a genuine CRM customer, optionally link its site/job/typed contract/schedule, and complete the ten sections. Save Draft is available on every step. A final review step precedes saving; submission is a separate server-validated action from report details.

The ten sections are client/service details; executive summary; pest findings; treatments, multiple products and safety; recommendations; photographs; site diagrams; signatures/acknowledgement; supporting attachments; follow-up and internal notes. Optional termite/reticulation fields are available inside treatments. No chemical concentrations, safety waiting periods, pest absence, certifications or completed work are generated automatically.

A customer signature records acknowledgement of receipt/details, not pest elimination or a waiver of rights. Unavailable/declined responses require a reason. Content/evidence changes invalidate current signatures. Capture signatures after all entries/evidence are saved.

Workflow: Draft → Submitted → Approved, with Submitted → Revision Required → Submitted. An approved correction explicitly opens a new editable revision and preserves all prior frozen versions and original evidence. A report's preparer, submitter and contributors cannot approve their own changes. Staff see server-calculated action flags according to explicit capability grants and record scope. All-record visibility does not grant editing, uploading or submitting another employee's draft. Final Review also provides signature capture after attachments and follow-up details are complete.

The dashboard calculates the seven requested metrics from the same permission/filter scope as its paginated list. Tables retain ten columns with local horizontal scrolling; action menus are portalled. New/edit/detail routes live beneath `/operations/service-reports`.

## Canonical ownership and identity

The ERP owns all report writes, validation, evidence, versions, approval and PDF generation. The versioned field contract is `backend/serviceReports/schema.json`, imported by the CRM form and backend normalizer.

Customers resolve by actual `customers.external_id`. Sites must belong to the customer. Jobs, typed invoice/standalone-contract references and saved invoice schedule references are checked together. A converted lead ID is never used as a customer ID. Snapshots preserve report meaning when master data changes.

Employee grants/assignments use the existing ERP login identity: employee payload `_id`, falling back to `external_id`/row ID, rather than assuming a numeric mobile API employee identity. Staff need explicit capabilities: view, create, edit, submit, review, pdf, share and history. Assigned scope covers owned/assigned reports and customers reached through assigned jobs; all-record scope requires an explicit grant. No Sales App identity adapter exists in this phase.

## Storage and migrations

Explicit scripts:

- `backend/migrations/service_reports.up.sql`
- `backend/migrations/service_reports.down.sql`

There are six new tables: `service_reports`, `service_report_versions`, `service_report_files`, `service_report_audit_logs`, `service_report_request_keys`, `service_report_permissions`.

Repeatable findings, treatments/products, recommendations, safety, acknowledgements and follow-up are stored as one validated aggregate JSON document; filterable fields are indexed columns. This avoids duplicating authoritative customer/job/service tables while making each submitted/approved snapshot atomic. Files, versions, audit events and permission grants are separate records. New child tables restrict deletion of their report. Existing customer, job, invoice, contract, schedule, stock and payment rows are never written by the module.

The up migration is deliberately not registered with startup auto-migrations. The down script drops only the new feature tables and is destructive to feature records; export/backup and separate operator approval are required before using it outside disposable QA.

The report number is derived from MySQL's atomic auto-increment identity and protected by a unique constraint. Gaps are intentional. UUID external IDs are used in API paths. Create requests require a stable `requestKey` or `Idempotency-Key`; matching retries reuse the report, changed payloads conflict. Edits/transitions/uploads require the current revision token and return 409 when stale. Frozen version numbers use those revision tokens, which need not be contiguous.

## Private evidence policy

Default root: `storage/private-service-reports`, excluded from Git. Operators may set `SERVICE_REPORT_PRIVATE_ROOT`. Startup rejects a root under the configured public upload root or backend public directory, including existing symlinks. Evidence files use UUID names and private filesystem permissions, with no static/public evidence route.

Only report-authorised staff can retrieve originals, previews and preserved PDFs. File metadata omits storage keys. Removed/replaced evidence is soft-removed; original bytes remain available to historical versions. Back up the private directory and report tables together. No existing retention duration was assumed and no automatic purge was added.

Accepted evidence: JPEG, PNG, WebP and PDF; maximum 8 MB per original, 25 megapixels per image, 50 current files and 80 MB of retained original/preview evidence per report. File signature and image decoding checks supplement extension checks. Sharp 0.34.5 creates bounded, aspect-preserving compressed JPEG preview/PDF derivatives; original bytes remain unchanged. Images, signatures and PDFs have SHA-256 integrity checks. Signature images are always included in the report PDF.

Site maps support image/PDF upload and editable annotation/monitoring-point text. Attached PDFs are referenced, not merged as untrusted executable PDF content. Internal notes and staff-only attachments are excluded from customer PDFs.

## PDF branding and sharing

The Renewal Letter renderer in `backend/server.js` is unchanged. `backend/serviceReports/pdf.js` follows its A4 page size, 45/45/55/55 point margins, official logo fit, company/contact arrangement, Calibri discovery with Helvetica fallback, and saved brand accent. GST/Non-GST fields and the corresponding official logo are selected explicitly; missing company name/logo blocks submission/PDF generation. A linked invoice's company identity must match the report.

Frozen versions embed an allowlisted branding snapshot and the exact original logo bytes/hash. Downloading a frozen version caches its PDF privately; subsequent downloads verify and return identical bytes. Content-aware pages repeat letterheads, finding-table headers and report page numbers; signatures stay together. Photos preserve aspect ratios. Long content is measured and split without fixed page counts.

Customer PDFs use an explicit content/settings allowlist. Internal notes, SMTP/API credentials, bank settings and unrelated confidential configuration are not passed to the renderer. All ten PDF scenarios use synthetic records and confidential sentinel values to verify exclusion.

Approved PDFs support the device's native file-sharing UI where available, with a download fallback. No public evidence URLs, automatic email/WhatsApp delivery or live provider calls are introduced. Physical camera/device sharing behavior is not claimed as device-tested.

## API surface

Base `/api/service-reports`, behind existing portal session authentication, CSRF, CORS and rate limiting, plus module capabilities and per-record scope.

- GET `/capabilities`, `/schema`, `/lookups`
- GET `/` — list, scoped metrics and pagination; filters number/customer/site/service/reference/job/employee/status/from/to
- POST `/` — idempotent draft creation
- GET/PUT `/:id` — detail / transactional aggregate draft update
- POST `/:id/files`, GET/DELETE `/:id/files/:fileId`; `?preview=1` retrieves a compressed preview
- POST `/:id/submit`, `/approve`, `/request-revision`, `/revisions`
- GET `/:id/history`
- GET `/:id/pdf`, optionally `?version=<frozen revision>`
- GET `/permissions`, PUT `/permissions/:employeeId` — existing administrators only

Errors return appropriate 401/403/404/409/422 statuses. The UI renders validation details and exposes loading/success/error states. There is no endpoint to overwrite/delete an approved snapshot, assign a client-supplied report number, change report status by draft PUT or write master records. Follow-up details do not create duplicate jobs or alter schedules.

## Reproducible local QA

The QA scripts deliberately do not import `backend/server.js` or load `.env`, because normal server startup includes existing automatic migrations/provider initialization. They use a fixed `/tmp/skuas-service-reports-phase2/mysql.sock`, fixed disposable database `service_reports_phase2_qa`, and validate that the server has networking disabled and its data directory is the expected disposable path. No DB host/password environment setting is accepted.

Start a disposable MySQL 8 instance with `--no-defaults`, a newly initialized `/tmp/skuas-service-reports-phase2/mysql-data`, `--skip-networking`, `--mysqlx=OFF` and the fixed Unix socket. Do not use an existing business database.

Then run from the ERP repository:

```sh
SERVICE_REPORT_LOCAL_QA=1 node --test backend/test/service-reports.integration.test.js
node --test backend/test/service-reports.test.js backend/test/service-reports-pdf.test.js
node --test backend/test/security.test.js
```

Integration setup applies up/down/up against synthetic master tables and checks existing master data preservation. It exercises real authenticated HTTP routes with portal cookies/CSRF, genuine-customer linking, external employee identities, permission grants/revocation, duplicate/concurrent creation, stale revisions, uploads/limits/compression/integrity, signatures, independent approval, historical snapshots/PDF bytes, master changes and shared-pool concurrency.

Build with Vite directed to an isolated output directory; do not run the root build script because it can publish generated assets into `backend/public`:

```sh
cd frontend
./node_modules/.bin/vite build --outDir /tmp/skuas-service-reports-phase2/build
```

For synthetic browser review, start `node backend/scripts/service-reports/local-server.js`, generate PDF samples using `SERVICE_REPORT_ARTIFACT_DIR=<review>/pdfs node --test backend/test/service-reports-pdf.test.js`, and run `seed-review.js` with the same PDF output directory. The harness never forwards unknown APIs externally.

`browser-qa.cjs` accepts `SERVICE_REPORT_ARTIFACT_DIR`, `SERVICE_REPORT_PLAYWRIGHT_MODULE` and optionally `SERVICE_REPORT_CHROME`. Install browser QA tooling separately under `/tmp`; it is not a production dependency. It checks the five requested widths in both themes and captures every form section, review, approvals, history and permissions. `browser-behavior.cjs` exercises the full UI-created report lifecycle, both signatures, the download-sharing fallback, expired sessions and network-failure recovery against the same local harness. Synthetic photo/signature fixtures are visibly labeled and must never enter production.

## Deployment boundary

Phase 2 has not been deployed. Production schema compatibility, actual saved GST/Non-GST identities/logo availability, deployed font availability, filesystem permissions/backup policy and physical device camera/sharing remain deployment/device acceptance checks. No production credentials were loaded for QA. Sales App integration remains Phase 3 and requires further approval.
