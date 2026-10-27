# Service Calendar presentation review — 27 October 2026

Status: implemented locally for review. No commit, push, deployment, migration, database operation or production API request was performed.

## Scope and reference

Matched the supplied **Modern October 2026 service calendar.png**: light panels, coloured summary icons, compact grouped month controls, rounded dates, blue selected-date styling and a selected-date side panel. Desktop uses 74:26 columns; at 1100px and below the services panel stacks beneath the calendar. Mobile uses two summary columns, all seven weekday columns and numeric count badges, with full counts retained in accessible date labels/tooltips. Existing dark mode remains available.

The reference's dates and figures were not copied into application data. The large day and weekday/month/year are derived through the existing date parser from `selectedDate`, independently of today and the visible calendar month.

Modified application files:

- `frontend/src/components/ServiceCalendar.jsx`: presentation wrappers, existing Lucide icons, selected-date presentation and accessibility attributes. Original populated service cards remain intact.
- `frontend/src/components/ServiceCalendar.css`: new styles scoped to `.service-calendar-modern`, including scoped overrides of pre-existing global calendar/theme rules.
- `docs/service-calendar-ui-review.md`: this review record.

No shared theme, shell, hook, route, backend or other dashboard file was changed. The new CSS is intentionally scoped and overrides the component's retained inline presentation defaults; it does not replace the portal's theme system.

## Existing behaviour recorded before editing

| Area | Existing behaviour, preserved |
|---|---|
| API | GET `/api/service-schedules`, existing `VITE_API_BASE_URL`, no request parameters. Backend derives records from invoice service plans; no synchronisation code was changed or invoked during this review. |
| Initial state | Current local month anchored to day 1 at midnight; selected date is the local current date. Cache key remains `service_calendar_cache_v1`. |
| Refresh | Initial load, manual Refresh, existing 60-second hook, focus and visible-page events. Silent loading/cached refresh and in-flight deduplication remain unchanged. |
| Loading/error/cache | Existing loading label, first-load error text, event clearing and silent/cached failure rules remain unchanged. Existing empty-state condition can also be true during an empty initial load/error; this was deliberately preserved. |
| Grouping | `serviceDate` first ten characters, existing `new Date`/local-midnight parser, generated-ID fallback, time normalisation/default 10:00, sorting by date/time then customer name. |
| Summaries | All supplied records, independent of visible month. Completed: completed/done/closed. Upcoming: non-completed valid date after memoised today. Pending: non-completed invalid/missing date or date at/before today. Total: raw event count. No rule or total was changed. |
| Calendar | Fixed 42 cells, Sunday first, adjacent-month dates remain selectable. Previous/next changes only visible month; neither selection nor API requests change. |
| Selected date | Uses the original grouped events. Existing item name, time, customer, invoice number, description and fallback text remain. Original renderer has no service-level links or action buttons; none were added or removed. |
| Empty state | Only `selectedDayEvents.length === 0` displays “No services scheduled for this date.” The reference's empty panel was not substituted for populated content. |
| Entry points | Existing route and manual header modal retained; no automatic opening, permissions or navigation changes. |

All date helpers, cache functions, state, loading functions, effects, grouping, summaries and existing responsive state/style calculations compare byte-for-byte with the baseline. All four original click-handler expressions and the populated event renderer also compare unchanged. New derived date labels and icons are presentation only.

## Verification and results

**PASS — local presentation and behaviour equivalence.**

- Production-mode Vite build passed, using the existing frontend configuration and isolated output at `/private/tmp/skuas-service-calendar-review/build`. The asset-copy/deployment step was not run, preserving `backend/public`.
- **123 focused source/browser assertions passed**, zero runtime exceptions. Original and redesigned components ran against the same intercepted fixtures with the browser clock fixed to 27 October 2026 in Asia/Kolkata.
- Baseline and redesign both returned summary values **3 completed, 6 pending, 3 upcoming, 12 total**. Fixtures include completed aliases, future completed records, overdue/today/future records, invalid/missing dates, adjacent months, invalid time and long populated fields. These values exist only in the external test harness.
- Compared all 42 cells/counts, initial selection, selected detail contents/order, January/year-boundary navigation, adjacent-month selection, empty-date selection, manual/focus/visibility/timer refresh, request method/path/parameters, in-flight deduplication, loaded/empty/error states and cached failure behaviour.
- Checked 320, 390, 768, 1024 and 1440px in both light and dark themes: **10 layout cases**, seven columns, no clipped tested labels/counts/details, no page-level horizontal scrolling, date-cell heights at least 44px and desktop 74:26 geometry. A 1,000-service count was also checked at 320px.
- Portal-shell and manual-modal checks passed at all five widths. Verified no automatic modal opening, populated modal content, no modal horizontal overflow, date selection/empty state, selected-date large label and Close.
- **142 measured text-contrast checks passed** in light/dark at 390px. Large bold summary values meet 3:1; measured normal text meets 4.5:1. Minimum measured ratio: 4.06:1 light (large summary value), 5.16:1 dark. This is a focused check, not a full accessibility certification.
- Existing `frontend/src/utils/brandingTheme.test.js`: **4 tests passed**.
- `git diff --check` passed. No backend/public changes; the 305 existing untracked generated assets remain outside this change.

## Review artifacts and reproduction

Artifacts are outside the application repository:

`/Volumes/skuas/Projects/design-previews/service-calendar-2026-10-27/`

- `light-1440.png`, `light-768.png`, `light-390.png`, `light-320.png`, `light-1024.png`: actual redesigned component, populated selected date, sample-data labels.
- `portal-light-1440.png`, `portal-light-768.png`, `portal-light-390.png`: component inside the unchanged portal shell with synthetic branding settings.
- `dark-390.png`, `before-desktop.png`, `after-desktop.png`: compatibility/baseline captures.
- `verification.json`, `contrast.json`: detailed results.
- `harness/`: saved original component, fixture adapter, local preview server and comparison/contrast scripts. All records are synthetic; no credentials/customer data are included.

To repeat locally, copy `harness/` into `/private/tmp/skuas-service-calendar-review`, start `node /private/tmp/skuas-service-calendar-review/server.mjs`, then run `node /private/tmp/skuas-service-calendar-review/verify.mjs` and `node /private/tmp/skuas-service-calendar-review/contrast.mjs`. These scripts require the existing local Chrome and frontend dependencies and are tied to this workspace path. They intercept Axios, reject writes, and block browser requests outside the isolated localhost preview. No backend server or production connection is required.

## Outstanding boundaries

No discrepancies were found in the isolated comparison. Live record accuracy, invoice-plan synchronisation side effects, production timezone/database state and deployed rendering were not verified. Existing parser/timezone behaviour, memoised today, status classification, cache semantics and empty/loading/error overlap are inherited unchanged; this UI task does not remediate them. No production endpoint was used as a verification shortcut.

Stop for review. Publication is not authorised by this task.
