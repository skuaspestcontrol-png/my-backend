# Portal UI standardisation

The approved light/dark Contracts reference supplies the portal's layout and visual language. The implementation uses the existing React components, Lucide icons and theme preference mechanism; it adds no dependencies or production routes.

## Shared foundation

`frontend/src/styles/portalDesign.css` is loaded after the legacy stylesheet. Its `--ui-*` tokens map onto existing surface, text, input, table, chart and status variables. Scope structural styles to `.portal-design-system`, shared modals and action menus. Do not add more broad inline-colour selectors to `index.css`.

- Light: navy `#1B2342`, secondary navy `#111B34`, page `#F4F6FB`, cards `#FFFFFF`, borders `#E2E8F0`, text `#172033`, secondary text `#64748B`.
- Dark: page `#0B1220`, sidebar `#101B30`, cards `#17243B`, elevated surfaces `#1D2D47`, borders `#30415D`, text `#F8FAFC`, secondary text `#AAB8CF`.
- White normal-size text on proposed dark action blue `#2878FF` has approximately 4.02:1 contrast. Actions therefore use `#2563EB` in dark mode (approximately 5.17:1). Light primary buttons follow the reference's navy treatment; links/focus use blue. Semantic status tokens have separate readable light/dark pairs.
- The dashboard container fills the available width next to the existing sidebar. Container queries adapt summary grids to the actual content width, including an expanded sidebar. Padding remains responsive.
- Navigation hierarchy, destinations, company/user controls and sidebar hover/pin/drawer state stay with `DashboardLayout`. Current links expose `aria-current`; the menu toggle reports its expanded state.
- Structural chrome/actions use the approved palette. Saved branding fields, persistence and APIs are unchanged. The configured logo URL is retained, with `object-fit: contain` and no colour filter. No replacement artwork is included.

## Component entry point

Import from `frontend/src/components/ui/index.js`. Existing direct imports remain compatible.

| Requested component | Implementation |
| --- | --- |
| PageHeader | Existing PageHeader, semantic responsive styling |
| SummaryCard | Existing DashboardStatCard |
| SummaryCardGrid | Controlled grid wrapper |
| FilterBar | Controlled layout wrapper; filtering stays with caller |
| StatusBadge | Existing labels/mapping with theme-aware colours |
| DataTable | Existing AppTable/ResizableTable; sizing and row bindings retained |
| TablePagination | Layout wrapper around caller-owned pagination controls |
| SearchInput | Existing SearchBar/AppInput |
| ActionButton / ActionMenu | Existing AppButton / ActionMenu |
| SectionCard | Existing AppCard |
| EmptyState | Existing component with semantic colours |
| LoadingState / ErrorState | Accessible status/alert presentation; caller owns fetch/retry |
| ConfirmDialog | Controlled shared Modal; caller owns confirmation action |
| ResponsiveFormGrid | Adaptive form grid; caller owns values/validation/submission |

Shared Modal now associates its title, traps keyboard focus, handles Escape and restores prior focus. Busy ConfirmDialog disables its close/cancel/confirm affordances. Existing module-specific confirmation and submission workflows are retained.

Example: wrap existing KPI components with `SummaryCardGrid`, or existing filter controls with `FilterBar`. Pass existing values and callbacks through unchanged. `TablePagination` does not paginate data. `ConfirmDialog` never issues an API request by itself.

## Existing module coverage

The shared shell, tokens, tables, controls and component styles reach all 53 protected page routes discovered in `App.jsx`, including aliases and parameterised pages. There are no new modules.

- Sales: lead capture/follow-ups, customers, contracts, invoices, quotations, payments, renewals, WhatsApp campaigns/details and sales performance dashboards/targets/reports.
- Operations: scheduling, service calendar, technician tracking/portal, field operations, complaints and certificates/workspace pages.
- Inventory/purchase: stock dashboard, items, purchases, issue/usage, reports, vendors, bills and vendor payments.
- HR: HR dashboard including its existing leave sections, employees, Attendance and Payroll including existing processing/history/slip/settings tabs.
- Administration: items, export, general/WhatsApp/email settings and existing UI demo pages.

Twenty-three bespoke modules additionally replace neutral hardcoded colours inside their style objects with semantic tokens. Contracts uses the new summary/filter/pagination wrappers; Stock Dashboard uses shared grids/loading/error states; Email Settings uses the responsive form grid. Existing components provide the equivalent shared behaviour elsewhere.

Contracts retains its three existing live financial summaries rather than inventing the mockup's additional KPIs or growth figures. Existing quick filters, financial values, services, dates, columns, sorting, pagination, relationships and document/actions remain bound to their original state and handlers. Its filter controls have accessible names and its wide table is keyboard-focusable.

Financial tables may scroll within their own regions on narrow screens so required columns remain available. Attendance keeps its existing fitted desktop table and mobile record layout, including native time pickers and autosave.

## Validation and boundaries

Local browser verification uses intercepted, labelled QA responses. No production data is inserted and external requests are blocked. API mutation attempts are intercepted, including existing Settings autosave and audience-preview requests. This is separate from authenticated production verification.

- All 53 discovered routes rendered at 1920px and 390px in both themes: 212 route/theme/viewport cases, no runtime exceptions or page-level horizontal overflow.
- Populated Contracts rows and all three summary values match the pre-change baseline exactly with identical fixtures. Search, light/dark appearance and widths 1920/1440/1366/1024/768/390 were reviewed.
- Attendance: 96 browser checks cover responsive sizing down to 320px, expanded/collapsed sidebar, filters, selection/export, typed/native time editing, autosave, leave/status updates, refresh persistence, location details, audit history and failure/loading states.
- Populated module and shared dialog review: 67 browser checks passed. Dialog checks cover explicit confirmation, focus wrapping/restoration, Escape and busy controls. Existing Employee and Email Settings forms were visually checked without submitting data.
- Source comparison: non-presentation syntax and every JSX event callback in 26 touched module/layout files match the baseline. Routes, saved-branding implementation and the pending Renewal Dashboard/filter utility remain byte-identical to that baseline.
- Frontend utilities/hooks: 36 tests passed. Backend security: 36 tests passed. Focused renewal filters/linking/date/batch/performance suites: 78 tests passed.
- Isolated production build succeeds under `/private/tmp`; no generated `backend/public` bundle is published.

The live configured logo asset and authenticated production workflows were not fetched or modified. No production financial posting, payroll run, message sending, GPS movement, permission change, commit, push or deployment is part of this verification. The earlier pending renewal-filter work and 305 untracked generated assets are preserved.

Known previous baseline: two assertions in `backend/test/renewals-hardening.test.js` expect obsolete tab/status branches; that mismatch was not included in the selected UI verification suites and remains outside this UI change. The focused renewal workflow suites above pass.
