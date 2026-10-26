# HR overview: Option 1 and portal data integration

Status: implemented locally for review. No production endpoint/database connection, schema migration, commit, push or deployment was performed. All browser captures and test records are synthetic. Production totals and schema availability remain unverified.

## Selected design and retained functionality

The owner selected Option 1, Clean Overview. The implementation uses the existing DashboardLayout, Branding variables, theme toggle and mobile drawer. Nine cards separate current-day recorded attendance from selected-month payroll/leave requests. Snapshot filters are now exposed, with their scope stated explicitly. Filters collapse on mobile. Existing department/role distribution, upcoming birthdays, leave submission/history/approval, employee/year leave entitlements, Edit/Save/Cancel, two-digit allocation validation, leave-balance columns, column-resize preferences and auto-refresh remain. No Recent Activities section was added.

All values come from API responses; no design-preview numbers are in application source. Currency uses the portal's whole-rupee display format without rounding stored totals. Birthday days now use the actual API `days` field, and birthdays occurring on the business date no longer roll into next year merely because midnight has passed.

## Connections

| Component | Read source | Safeguard |
|---|---|---|
| Employee totals, active employees, roles/departments, birthdays, employee selectors | Canonical `employees` SELECT mapped through the existing portal employee parser; minimal `/api/hr/employees/overview` feed | No employee-auth column setup or credential columns requested. Selector response exposes only necessary identity/name/role fields. Existing HR access boundary applies. |
| Recorded Present / On Leave | Stored attendance fields plus existing payload fallbacks from the same columns used by the Attendance portal | No writes, schema setup, invented punches or name matching. Present explicitly requires raw `present` status, not the old display fallback for a blank status. Unknown employee IDs make affected figures unavailable. |
| Monthly payroll cards | Direct SELECT of saved `payroll_records` fields | No Payroll cache hydration, DDL, draft/hold normalisation or salary recalculation. Stored `net_salary` takes precedence over stale JSON payload money. Null/invalid money fails closed. |
| Leave requests / status / pending count | Existing `/api/hr/leaves`, selected month/year | Existing start-month request semantics preserved. Not a count of leave-days or every overlapping request. |
| Leave balances | Existing `/api/hr/leaves/balance` and existing calculations | Canonical employees and live leaves are used. No balance formula changes. Configured defaults remain unchanged. |
| Leave entitlements | Existing employee/year `/api/hr/leave-entitlements` | Failed/missing responses no longer become client-side zero allocations. SQL read errors are propagated. Existing allocation defaults, limits and write validation are preserved. |
| Employee / attendance / payroll shortcuts | Existing `/employees`, `/attendance`, `/payroll` routes | No new fake routes, role expansion or direct payment actions. |

When MySQL is configured, SQL read errors never silently become stale JSON data. An explicitly JSON-configured installation still uses its configured JSON source. The summary identifies source type and per-source availability.

The shared canonical employee reader also supplies HR filter options, leave/balance identity lookups and existing employee-based HR handlers. All call sites now await that reader. Payroll's canonical reader is scoped to the dashboard summary; existing separate HR financial-report getters retain their existing source and calculations pending reconciliation.

## Read-path safety and privacy

`hrPortalReaders.js` issues SELECTs only. Employee reads do not select password columns; the new selector feed is explicitly allowlisted. Attendance reads use existing DATE_FORMAT/TIME_FORMAT constructs already present in the repository's Attendance query, without invoking its schema initializer. Payroll reads use persisted columns without importing or invoking the write-capable payroll loader.

The dashboard summary no longer calls workflow/performance seed helpers. Workflow filters match stored statuses only; missing workflow records are not invented as Active. Missing auxiliary tables produce availability flags; it does not create or populate them. Module startup and legacy non-dashboard workflows retain their existing behaviour. This is not a claim that every pre-existing portal GET is read-only: Payroll's own loading middleware and legacy HR seed-capable endpoints remain separate review items.

The HR-only summary and selector feed enforce the existing shared HR access policy. No employee/self-service access was broadened. Client cache keys include both actor ID and actor role separately from the employee-role filter. Older responses cannot overwrite newer filter or entitlement selections, including refreshes triggered by a save that completes after the selection changes. Old month/filter totals are hidden while another snapshot is loading; old leave rows are not presented under a different selected month.

## Definitions deliberately held for review

- **Technicians On Duty:** card retained but unavailable. The inherited counter covers on-duty across roles; no new role/duty business definition was guessed.
- **Absent Today:** card retained but unavailable. Working-day, weekly-off, holiday, approved-leave precedence and sync-completeness rules have not been established. No total-minus-present calculation was introduced.
- **On Leave Today:** displays existing recorded-leave semantics, explicitly not a verified approved-leave headcount. No new approved-leave card was fabricated.
- **Pending Salary:** preserves the old sum of full net salary for non-Paid rows. Caption explicitly identifies that basis. It is not verified as remaining liability after partial payments.
- **Unmatched IDs / conflicting same-day attendance:** no name matching, implicit status selection or historical remapping. Affected payroll/attendance values become unavailable and a review notice is shown.

The dashboard's reference day is now explicitly Asia/Kolkata, following the portal's existing India-time convention, independently of selected month/year. Monthly date grouping, attendance work rules, salary formulas, approved leave usage and historical records were not modified. Production server timezone was not inspected.

## Financial impact and release boundary

Payroll arithmetic is unchanged: selected employee/month/year net totals and full-net non-Paid totals. Stored decimal amounts are preserved; only display uses whole rupees. Because HR previously read `payroll_items` while Payroll hydrates `payroll_records`, switching the dashboard to canonical saved records can change displayed HR figures if those stores differ. The amount of that difference is unknown until an approved read-only reconciliation is completed. No historical record was updated or salary recalculated.

The Payroll portal may normalise editable draft/hold rows during its existing loader. This implementation deliberately does not invoke or reproduce that behaviour. Therefore equality between its currently cached figures and persisted HR read-only figures is not asserted. Separate legacy HR reports and payroll trends remain unreconciled; the selected Option 1 does not introduce those trend charts or a new Reports button.

Production verification must establish table/column availability, stable employee IDs, chosen month/year totals, partial-payment/hold treatment, leave overlaps and date boundaries. Use a dedicated read-only connection for that audit; do not test write-capable GETs as a shortcut. This task has not performed that reconciliation and is not financial deployment sign-off.

## Validation

- Backend reader/integration regressions: **16 passed**. They cover SELECT-only queries, persisted money, missing/failed sources, genuine empty sources, separate reporting day, unmatched IDs, minimised employee responses, HR permissions, raw Present status and same-day birthdays.
- Existing security regressions: **36 passed**. Payroll/weekly-off regressions: **7 passed**. No production data was used.
- Browser fixtures: **87 checks passed**, with zero runtime errors across 12 layout cases. They cover light/dark at 320, 390, 768, 1024, 1440 and 1920px, nine live-bound cards, whole-rupee display, availability versus zero, no page-level horizontal scrolling/clipped card values, source endpoints, request races, role isolation and leave/entitlement actions. All mutations were intercepted in memory. Production origins were blocked.
- Isolated Vite build output is under `/private/tmp/skuas-hr-live-build`; generated `backend/public` assets were not touched.

No production credentials or employee/payroll records were printed or used in previews. Await review before publication.
