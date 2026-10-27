# Portal refresh performance audit — 27 October 2026

Status: local fixes complete for review. The owner reports delays when opening/refreshing All Contracts. No production request, database connection, migration, commit, push or deployment was performed. Tests and browser profiles use synthetic records/mocked connections only.

## Findings and local fixes

| Finding | Scope | Fix |
|---|---|---|
| Every successful Contracts refresh replaces all arrays, even when all data is identical. This rebuilds customer/schedule indexes, contract projections, filters and sorting. It also rewrites a large synchronous sessionStorage snapshot. | All Contracts | Compare every JSON field and retain unchanged array references. Skip cache writes for unchanged snapshots. Real nested field changes, record additions/deletions and reordered arrays remain detectable. No IDs-only shortcut, dropped records or truncated totals. |
| Sort comparators repeatedly parse the same dates/numbers and initialise locale-aware comparisons. | All Contracts | Compute sort values once per row; reuse one Intl.Collator with the existing numeric/base settings. Preserve all legacy sort keys, directions and stable tie order, including the existing Invoice Date/type mapping. |
| A cache containing only column preferences is treated as loaded contract data. | All Contracts opening | Require invoice/customer/schedule arrays before treating the cache as a snapshot. Show Loading while real records arrive, and show unavailable rather than zero for never-loaded summary values. |
| Read requests have no timeout or navigation cancellation. Background failures give no fresh-data warning. | All Contracts | Bound core reads and the payment/fallback budget to 20 seconds. Abort when leaving the page; support StrictMode cancellation/restart. Preserve loaded records on failed/malformed refresh and show a Retry message. Cold failure also offers Retry. |
| Holding data references could otherwise freeze date-derived statuses at midnight. | All Contracts | Re-evaluate the existing status/schedule calculations when the existing local reporting date advances on a successful refresh. Date parsing, timezone and status rules are unchanged. |
| Passive refreshes continue in hidden tabs; paired focus/visibility events can cause repeated refreshes. | Shared useAutoRefresh consumers, main Dashboard, notifications | Skip hidden-tab periodic work and coalesce passive events within one second. Keep configured intervals and explicit mutation/manual refresh handlers. Main Dashboard retains 15-second cadence; notification interval remains 60 seconds. |
| Tracking/campaign pages have separate polling loops. | Track Technicians; WhatsApp campaign detail | Use the same visibility-aware hook at the existing 30-second and 5-second cadences. Resume display reads on visibility. GPS collection, routes/distance, campaign processing and campaign action requests are untouched. |
| The payment feed awaited by Contracts invokes finance-table setup on every read: four CREATE-if-absent statements and eight column metadata checks in an already-current schema. Vendor/bill/payment modules share this initializer. | Existing backend finance initializer | Wrap the existing initializer with the repository's onceAsync utility. Concurrent requests share one attempt, warm requests repeat none of those checks, failed initialisation can retry. All table/column definitions and financial queries remain unchanged. |

The final source scan finds explicit frontend polling timers only in the guarded shared hook, guarded Dashboard loop and guarded notification loop. Initial/manual reads still run; hiding a tab does not stop GPS collection or pause a campaign.

## Measured browser result

Synthetic dataset: **3,000 invoices/customers and 36,000 schedules**, same data and default date sort before/after, Chromium with **4x CPU throttling**, isolated Vite development rendering. Production APIs were replaced by a fixture adapter and external requests were blocked.

| Unchanged refresh metric | Before | After |
|---|---:|---:|
| Sum of browser long-task durations | 690 ms | 225 ms |
| Largest recorded blocking task | 464 ms | 136 ms |
| Synchronous sessionStorage setItem time | 32.7 ms | 0 ms |

This is about **67% less long-task blocking** in that controlled refresh, not a claim that production network/page-load time improved by 67%. Long-task measurements exclude tasks below the browser's 50ms reporting threshold. Both versions displayed 3,000 records, identical rows/order/filter options, and identical synthetic money totals. Backend latency and cold-start effects were not measured live.

## Verification

- **40 browser/source checks passed**, zero runtime exceptions: before/after rows, totals, ordering and filters; unchanged cache-write suppression; real/nested changes; bounded/cancellable read configs; warm/cold failure and Retry; malformed response protection; preference-only loading; unmount cancellation; StrictMode; date rollover; hidden/focus/in-flight/failure/disabled hook behaviour; 5/15/30-second custom intervals; Contracts at 320, 390, 768, 1024 and 1440px.
- **22 frontend tests passed**, covering full-value comparison, all legacy sort keys/directions and ties, one date parse per row, passive-refresh policy, and existing branding/monthly-target/duration rules.
- **11 backend/performance tests passed**, including mocked initializer concurrency, zero warm schema checks, retry after failure, monotonic request/fallback deadlines, cancellation and existing renewal responsiveness tests.
- **36 existing security tests passed**.
- A pre-existing renewal test failed on unchanged HEAD because its fixture omitted the current `existingReviewRequirements` dependency. Only the normal eligible-candidate test fixture was repaired. No renewal handler/review guards were changed.
- Production-mode Vite build passed into isolated `/private/tmp/skuas-portal-performance-review/build`. Backend syntax and `git diff --check` passed. No backend/public copy step was run; the 305 pre-existing untracked generated assets remain untouched.

## Files

Application: `backend/server.js`; `frontend/src/components/ContractDashboard.jsx`, `Dashboard.jsx`, `DashboardLayout.jsx`, `TrackTechnicians.jsx`; `frontend/src/hooks/useAutoRefresh.js`, `autoRefreshPolicy.js`; `frontend/src/pages/sales/WhatsAppCampaignDetails.jsx`; `frontend/src/utils/contractPerformance.js`.

Tests: `backend/test/portal-refresh-performance.test.js`, `backend/test/renewals-performance.test.js`; `frontend/src/hooks/autoRefreshPolicy.test.js`; `frontend/src/utils/contractPerformance.test.js`. This report is the only added documentation file.

## Boundaries and follow-up

- Production slowness is **not live-verified**. These changes fix reproduced client blocking and source-confirmed repeated setup work. Actual Hostinger response times, database load/pool waits, locks, network quality and deployed bundle/cache state still need observation after approved publication.
- Existing financial GETs can still initialise schema on their first call; caching initialization does **not** make those GETs read-only. They were not invoked against production. No SQL definition, salary/invoice calculation, status treatment, historical total or permission was changed.
- Do not diagnose by calling write-capable financial GETs or using write database credentials. For live confirmation, collect sanitised endpoint/status/duration timings from ordinary portal use and server resource logs, without exporting customer data or credentials. Any database profiling should use a separately approved read-only connection.
- Large first responses still contain the existing complete datasets; no server pagination, record cap, data truncation or new API was introduced. sessionStorage quota and full-payload transfer remain limitations. PDF/upload/report requests were not given a global timeout.
- A separate inherited Contracts payment-activity mismatch remains: the payment helper returns an array while the loader reads `.data`. This was not changed during the performance fix because correcting it changes the popup's paid/activity figures and needs separate financial review. Contracts card/row amount, paid and due formulas are unchanged.

Evidence: `/Volumes/skuas/Projects/design-previews/portal-performance-2026-10-27/` and `/private/tmp/skuas-portal-performance-review/`. All records in the harness are synthetic. Stop for review before publication.
