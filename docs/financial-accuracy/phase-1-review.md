# Financial accuracy remediation — Phase 1 review and reconciliation procedure

Phase 1B update: current SQL batches, compatibility gates and output semantics are documented in [phase-1b-execution-plan.md](phase-1b-execution-plan.md). The previous SQL candidate-issued totals have been removed; eligible sales remain NULL/UNVERIFIED pending reconciliation.

Status: local percentage fix implemented; production reconciliation NOT RUN; financial deployment sign-off remains blocked. No production connection, endpoint, migration or data write was used. The SQL companion is a preparation artifact, not verified production output.

## 1. Owner-confirmed policy

Sales achievement is the GST-inclusive total value of eligible invoices issued, independent of collections. Include issued/finalised unpaid, partially paid and paid invoices; exclude drafts/cancelled/void documents. Count a canonical invoice once, use stable salesperson IDs and verified issue dates, and deduct valid linked credit/reversal sales adjustments after verifying the accounting model. Payment receipts are never additional sales. No historical/yearly treatment changes are implemented in this phase.

## 2. Percentage fix and impact

For target ₹1,00,000 and achievement ₹450, the previous frontend calculation formatted the unrounded floating-point ratio as 0.4%. The existing API's `percent` helper returns `Math.round((achieved / target) * 1000) / 10`, or 0.5%. `monthlyTargetSummary.js` now uses that exact expression for a positive target. This is deliberately compatibility rounding, not a new rounding/accounting policy; existing binary floating-point tie behaviour is retained.

Only that frontend arithmetic expression and its explanatory comment changed. Target ₹1,00,000, achievement ₹450 and pending ₹99,550 remain unchanged. Currency formatting, configuration detection, zero/missing-target behaviour and yearly percentages are unchanged. Progress now follows the same rounded percentage as the display, capped at 100%. API regression tests confirm 0.5% from the actual route handler with isolated database fixtures. Unit cases cover both sides of the tie, other decimal ties, overachievement and missing/zero targets.

Direct financial effect: ₹0 change to sales/target/pending; corrected display differs by 0.1 percentage point in the reproduced case. Production incidence and aggregate exposure are unknown; no claim is made that production records have been reconciled.

## 3. Exact source/schema findings (live metadata still unverified)

| Item | Verified in repository | Reconciliation consequence |
| --- | --- | --- |
| Canonical invoice | `invoices.id`: primary key; `external_id`: unique key. The application persists invoice `_id` as `external_id`. | Use `id` as database canonical identity and `external_id` as its unique application alias after verifying live indexes. |
| Business number | `invoice_number`: ordinary non-unique index. | Repeated numbers are discrepancy candidates, not sufficient authority to merge/delete distinct canonical invoices. Check series/company/year rules. |
| Status | `invoice_status VARCHAR(80)`, unrestricted vocabulary; payload `status`. Normal UI creation/finalisation writes `SENT`; settled invoices use `PAID`; partial-payment invoices remain `SENT`; `DRAFT` is recognised and converted to `SENT` on issue. `OVERDUE` is recognised for display. | `SENT`/`PAID` are evidenced issued-state candidates. There is no evidenced distinct persisted partial-payment status. Inventory live values; do not assume `UNPAID`, `PARTIALLY_PAID`, `ISSUED`, `FINALISED` or cancellation aliases exist. Unknown, conflicting and derived statuses require lifecycle verification. Owner policy includes all verified issued states regardless of payment. |
| Source pointers | InvoiceDashboard.jsx: emptyForm, applyComputedTotals, submit flow; server.js: hydrateInvoiceMysqlRow, syncInvoiceToMysqlOnConnection, issue/payment logic; invoice-auto-issue.test.js. | Use table/payload conflict counts. The invoice API normally gives `invoice_status` precedence; Sales Performance currently does not use invoice status to exclude any revenue rows. |
| Amount | `total_amount DECIMAL(18,2)` plus payload subtotal, totalTax, total/amount, discount, withholdingAmount, roundOff. | Existing sales gross prefers positive subtotal + totalTax. Persisted total can differ because the editor also subtracts discount/withholding and adds round-off. Do not silently switch amount bases or treat tax withholding as a revenue reversal. Quantify and review the differences. |
| Issue date | `invoice_date DATE`, payload date/invoice_date, created_at and source_created_at timestamps. | A DATE is a business date, not automatically a UTC instant. Creation/payment/due/service dates must not replace issue date without approval. Current sales fallback order can use creation time when issue date is absent. |
| Employees | `employees.id` primary key, unique external_id, emp_code ordinary index, names and JSON payload. | Validate uniqueness of ID aliases and codes; do not presume every legacy code is unique. |
| Invoice salesperson | Base invoices schema has no canonical salesperson FK. The current invoice editor saves `payload.salesperson` as a selected NAME. Sales Performance accepts numerous ID/name/created-by aliases. | Stable-ID attribution is not established for every invoice. Audit ID alias presence, null/invalid values, collisions, unassigned records and legacy name-only rows. Do not auto-convert historical names to IDs. |
| Targets | sales_targets has sales_person_id INT, target_type monthly/yearly, target_month/year, revenue_target, is_active, unique external_id and composite unique period key. Runtime code also supports optional employee_id/name/code columns. | Check actual columns/indexes first. Runtime normalisation may use aliases before the typed ID. Monthly target is configured monthly rows, never yearly/12. Explicit yearly targets override monthly-sum fallback per employee. Nullable months can weaken a composite unique key for yearly rows. |
| Adjustments | No dedicated sales credit-note/refund/reversal table or invoice adjustment FK was found in the inspected schema/migrations and invoice save paths. Existing customer unusedCredits, payroll adjustments and stock returns are not proven invoice sales reversals. | Exact valid adjustment relationships are UNVERIFIED. Discover live tables/FKs and document identity, original invoice link, posting status, GST-inclusive signed amount, date and void/reversal chain. Do not infer a link from text or subtract an unrelated payment/refund. |

The sales normaliser checks invoice ownership references in this exact order: sales_person_id, sales_person, salesPerson, salesperson, salespersonId, salesperson_id, assigned_to, assignedTo, employee_id, employeeId, created_by, createdBy, sales_id, salesId, sold_by, soldBy. It separately checks sales_person_name, salesPersonName, salespersonName, salesperson_name, assigned_to_name, assignedToName, employee_name, employeeName, created_by_name, createdByName. These are legacy candidates, not validated stable-ID columns. The value resolver accepts the first non-null/non-empty value, so a name-valued earlier field can hide a later real ID. Current record source is `{...payload, ...row}`; column collisions can also override payload values.

Source basis: backend/db/schema.sql; backend/migrations/sales_performance_simple_mysql.sql; backend/routes/salesPerformanceRoutes.js; backend/server.js; frontend/src/components/InvoiceDashboard.jsx. Repository schema files are not proof of deployed schema; runtime ensures/backfills make drift possible.

## 4. Establish a safe audit source before any financial query

1. Prefer a DBA-provided, consistent point-in-time snapshot or read replica with recorded replication/snapshot watermark. Do not request a full dump containing customer or credential data. Aggregate only the fields needed by the reviewed queries.
2. Hostinger standard hPanel databases may allow only one user per database: never reduce the CRM application user to read-only; obtain a separate audit copy if a dedicated account cannot be provisioned. If the platform permits a separate account, ask the DBA to provision a separate, short-lived audit principal restricted to SELECT on the necessary base tables and metadata, with host/network restrictions and verified TLS. It must have no write, schema, FILE, EXECUTE, temporary-table, locking or administrative privileges, including through roles. Account creation and privilege administration are DBA activities outside this task; no privilege-changing SQL is supplied or executed here.
3. Obtain DBA attestation of effective direct and role-inherited permissions and any connection initialisation hooks. Do not discover capability by attempting a write. A session/read-only flag alone is not proof: it may allow temporary writes or privileged bypasses. Never substitute application/production write credentials without explicit approval.
4. Use a clean MySQL client with no option-file initialisation or application ORM hooks. For example, replace only approved non-secret placeholders:

   ```sh
   MYSQL_HISTFILE=/dev/null mysql --no-defaults --host=<approved-read-endpoint> --user=<audit-principal> --password --database=<approved-schema> --ssl-mode=VERIFY_IDENTITY --ssl-ca=<approved-ca-path> --local-infile=0 --skip-auto-rehash --batch
   ```

   Enter the audit password at the prompt. Do not place it in shell history, process arguments, environment variables, chat or reports. Confirm client/version support; never bypass TLS verification to make the connection work. No connection was attempted in Phase 1.
5. Do not start the application, import backend/server.js, invoke Sales Performance GET endpoints, call schema helpers or use existing migration/export routes. Sales Performance GET middleware calls ensureSchemaReady and loadSalesContext calls syncSalesTargetEmployeeFields, both capable of writes.
6. Use the companion `production-reconciliation-selects.sql` block by block only after schema/privilege review. It contains SELECT statements against base tables/information_schema and built-in expressions only. No stored routines, view execution, locking reads, session changes, table creation, data changes or server-side file output are permitted. Check DBA operational read/load limits before full-table scans.
7. All financial comparisons must use the same immutable snapshot. Sequential SELECT statements on a changing primary are not a consistent reconciliation; if a snapshot/replica cannot provide a stable comparison point, mark the result inconclusive. No transaction/session-changing SQL is proposed to simulate this.

## 5. Current SELECT-only batches (Phase 1B supersedes the original query walkthrough)

See [phase-1b-execution-plan.md](phase-1b-execution-plan.md) for the complete current checklist, vendor/version assessment, cost gates, remaining assumptions and compact report format. The companion SQL is still 21 statements, identified S01–S21; physical order now follows the three batches, so use stable IDs rather than counting file position.

- **Batch A — metadata:** S01–S04. Engine/version/timezone labels, actual base-table columns/types/engine/collation, indexes and relationship metadata. Production compatibility is not known in advance.
- **Batch B — financial baseline:** S05–S07 and S09–S10. Raw target configurations; period/status inventory with a separate all-period missing-issue-date bucket; provisional month/year persisted ledger values. No status is implicitly eligible. Verified eligible sales are NULL with an explicit UNVERIFIED flag. These queries require the same immutable snapshot and approved scan budget.
- **Batch C — data-quality investigation:** S08 and S11–S21. Status/JSON/amount/date exceptions, identity and employee-mapping gaps, adjustment discovery, global-cap completeness and amount/date provenance. Full JSON scans, regex grouping and correlated employee scans may be expensive. Counts/amounts describe their stated scope, not a complete owner-policy financial result.

S07/S09/S10 use the same status precedence and classifier, also used by S08: non-empty column status, then payload string fallback if non-conflicting. Conflict, malformed payload/type and unknown/missing status are explicit exception buckets. All-period NULL issue dates are never silently assigned to a selected month/year or reported as zero because a date filter hid them. Status recognition is diagnostic vocabulary only, not approved financial eligibility.

Money remains NULL when unverified or absent rather than being formatted as zero. A genuinely configured zero target is distinct from no configured target. Persisted ledger sums do not establish the API's GST-inclusive gross basis; no receipts are added as sales. Credit/reversal totals stay UNVERIFIED until the real adjustment model and policy periods are reviewed.

Full reconciliation still requires exact legacy aggregation parity and a separate reviewed owner-policy computation: canonical eligible issued invoices once, stable attribution, original GST-inclusive basis, verified issue dates, valid linked sales adjustments, full dataset coverage and exception bridges. Do not call application GET endpoints to obtain those values. Previously captured aggregate API results are comparable only with the same period/scope/snapshot watermark; otherwise API parity stays UNVERIFIED. Explicit annual targets can differ from monthly target sums; yearly pending is not summed monthly pending, and yearly percentage is not averaged monthly percentages.

No SQL has been executed. The engine/schema, status vocabulary, adjustment relationships, complete employee mapping and financial exposure remain unverified. Do not upgrade production, create schema, change permissions or invoke a backfill to make the audit run.

## 6. Financial impact and sign-off

| Finding | Verified local behaviour | Production exposure |
| --- | --- | --- |
| Monthly percentage | Example corrected from 0.4% to API-compatible 0.5%; pending unchanged at ₹99,550 | Display only; ₹0 direct monetary change. Occurrence count not measured. |
| Ineligible status inclusion | Existing aggregator ignores invoice eligibility; cancelled/draft invoices can contribute | Unknown rupee overstatement until issued-state counts/totals are reconciled. |
| Identity/name fan-out | Isolated audit reproduced ₹11,800 becoming ₹23,600 through repeated business invoices or name collisions | Unknown; canonical duplicate/fan-out counts and scope must be measured. Different IDs sharing a number are not automatically duplicates. |
| Credits/reversals | Current positive-gross resolver and source loading do not implement linked credit accounting | Unknown; no verified sales adjustment relationships yet. Never assume cash refunds equal sales reductions. |
| Period/timezone | Same boundary instant can group into different months in UTC versus India | Unknown period shifts; year-boundary shifts can also change yearly totals. |
| Limits/fallback | Global newest-4000 invoices, newest-3000 employees, swallowed read errors and JSON fallback | Unknown missing/stale amounts; failure is not equivalent to genuine zero. |
| Amount basis and reporting scope | Gross resolver and persisted invoice total can differ; active-team cards and all-invoice trend differ | Unknown legitimate vs erroneous delta; needs an explicit bridge and owner review. |

Deployment financial sign-off remains FAIL/UNVERIFIED until production reconciliation is completed safely and reviewed. The local rounding-only change is independently reviewable. Phase 2 plan is in phase-2-remediation-plan.md. Do not modify historical/yearly logic until that review and explicit approval.

## 7. Local validation and review artifacts

- Frontend calculation regressions: 9 passed.
- Actual Sales Performance route/API fixture regressions: 8 passed, including ₹1,00,000 / ₹450 -> 0.5%; existing security tests: 36 passed (44 combined backend tests).
- Isolated production frontend build passed; generated production assets were not updated.
- Focused browser checks at 1440px light and 390px dark: both passed, showing ₹1,00,000.00 target, ₹450.00 achieved, ₹99,550.00 pending and 0.5%; yearly cards unchanged, no new monthly overflow, no runtime exceptions.
- Historical Phase 1 validation: the original companion SQL contained 21 SELECT statements that passed a static safety scan; NOT executed or syntax-validated against a production database. Static review is not a permission check, schema confirmation, performance assessment or financial reconciliation.
- Existing 305 generated untracked assets remain untouched; nothing staged, committed, pushed or deployed.
- Local test logs/screenshots: /private/tmp/skuas-finance-phase1-review/. Financial screenshot values are test fixtures only.

Phase 1B local validation supersedes the original SQL review: 21 SELECT ASTs parse successfully; 11 offline structure/safety tests pass. No database connection or SQL batch execution, including local execution, was performed. See the Phase 1B plan for test reproduction and limitations.
