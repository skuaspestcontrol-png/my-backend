# SKUAS CRM/ERP Glass Modern — Phase 1 audit and approval plan

Date: 31 October 2026. Repository: `/Volumes/skuas/Projects/skuasmaster-erp`. Baseline HEAD: `ea1451481107e6818948c2f76c56fb7e97fda836`. This is an audit of the **current working tree**, including pre-existing unpublished Renewal edits; it is not a statement that production matches this checkout.

**Phase 1 complete. The audit performed no application implementation, deployment, database work, production mutation or message send.** This repository review package was published after the separate user instruction “push”; it contains documentation and fixture screenshots only. No UI implementation is included. The supplied brief says: “STOP after Phase 1 and wait for my approval before implementation.” Phase 2 and later phases remain pending approval.

## 1. Audit scope and authoritative route inventory

`frontend/src/App.jsx:291–368` registers **78 route entries: 54 rendering paths, 23 redirects and one wildcard fallback**, mapping to 48 distinct page-component identifiers. Of the rendering paths, `/` is Login; the other 53 use AppRoute → ProtectedRoute → DashboardLayout. This is a session boundary, not proof of role-specific access for every operation. Existing internal role/access handling remains authoritative.

[Complete route migration checklist](route-migration-checklist.csv) includes every entry, source line, renderer, phase, risk, preservation requirements, acceptance checks and pending migration status. All **99 statically detectable literal navigation references** matched a registered path. This cross-check does not prove dynamic-ID navigation, browser-back behavior, query preservation or authorization; those need runtime regression tests.

The inventory includes routes absent from the reference collage: export data, stock reports, vendor payments, email logs/templates, technician detail aliases, standalone service calendar, sales/operations workspaces, certificates, Login and `/ui/*` pages. No module is assumed to exist just because it appears in the illustrative brief.

### Canonical renderer checklist

The full CSV retains each alias and redirect separately. Counts below are heuristic JSX-source occurrences, not counts of visible elements at runtime. Columns “inline / tables” mean inline `style={...}`/style bindings and literal `<table>` declarations.

| Representative path | Renderer | Planned phase | Risk | Inline / tables |
|---|---|---:|---|---:|
| `/` | Login | 5 | MEDIUM | 16 / 0 |
| `/dashboard` | Dashboard | 3 | HIGH | 103 / 0 |
| `/ui/dashboard` | UIDashboardPage | 5 | MEDIUM | 5 / 0 |
| `/ui/customers` | UICustomersPage | 5 | MEDIUM | 3 / 0 |
| `/leads` | LeadCapture | 3 | HIGH | 272 / 1 |
| `/leads/followup` | LeadFollowups | 3 | MEDIUM | 51 / 1 |
| `/quotations` | QuotationDashboard | 3 | HIGH | 59 / 1 |
| `/quotations/new` | CreateQuote | 3 | HIGH | 119 / 1 |
| `/sales/contracts` | ContractDashboard | 3 | HIGH | 212 / 3 |
| `/sales/customers` | CustomerDashboard | 3 | HIGH | 320 / 7 |
| `/sales/invoices` | InvoiceDashboard | 3 | HIGH | 303 / 3 |
| `/sales/payment-received` | PaymentReceivedDashboard | 3 | HIGH | 41 / 1 |
| `/sales/renewal` | RenewalDashboard | 3 | HIGH | 315 / 5 |
| `/sales/whatsapp-marketing` | WhatsAppMarketing | 5 | HIGH | 284 / 4 |
| `/sales/whatsapp-marketing/campaigns/:id` | WhatsAppCampaignDetails | 5 | HIGH | 33 / 1 |
| `/sales-performance/dashboard` | SalesPerformanceDashboard | 3 | HIGH | 26 / 1 |
| `/sales-performance/targets` | SalesTargets | 3 | HIGH | 56 / 2 |
| `/sales-performance/team-performance` | SalesTeamPerformance | 3 | HIGH | 45 / 1 |
| `/sales-performance/reports` | SalesPerformanceReports | 3 | HIGH | 71 / 1 |
| `/stock/dashboard` | StockDashboard | 4 | MEDIUM | 14 / 0 |
| `/stock/items` | StockItems | 4 | MEDIUM | 60 / 1 |
| `/stock/purchase` | StockPurchase | 4 | HIGH | 27 / 1 |
| `/stock/issue-usage` | StockIssueUsage | 4 | HIGH | 27 / 1 |
| `/stock/reports` | StockReports | 4 | HIGH | 68 / 7 |
| `/purchase/vendors` | VendorDashboard | 4 | MEDIUM | 87 / 1 |
| `/purchase/bills` | VendorBillsDashboard | 4 | HIGH | 106 / 2 |
| `/purchase/payment-received` | VendorPaymentDashboard | 4 | HIGH | 38 / 1 |
| `/whatsapp` + aliases | ModuleWorkspace | 5 | MEDIUM | 25 / 0 |
| `/settings/whatsapp` | WhatsAppSettings | 5 | HIGH | 23 / 0 |
| `/settings/whatsapp/templates` | WhatsAppTemplates | 5 | HIGH | 35 / 1 |
| `/whatsapp/logs` | WhatsAppLogs | 5 | HIGH | 29 / 1 |
| `/settings/email` | EmailSettings | 5 | HIGH | 28 / 0 |
| `/settings/email/templates` | EmailTemplates | 5 | HIGH | 35 / 1 |
| `/email/logs` | EmailLogs | 5 | HIGH | 42 / 1 |
| `/schedule-job` + aliases | ScheduleJob | 4 | HIGH | 94 / 1 |
| `/service-calendar` | ServiceCalendar | 4 | HIGH | 36 / 0 |
| `/tasks/detail` + aliases | TechnicianPortal | 4 | HIGH | 301 / 2 |
| `/operations/track-technicians` | TrackTechnicians | 4 | HIGH | 124 / 0 |
| `/sales-portal` | SalesPortal | 3 | MEDIUM | 0 / 0 |
| `/operations-portal` | OperationsPortal | 4 | MEDIUM | 0 / 0 |
| `/complaints` | ComplaintsDashboard | 4 | HIGH | 110 / 1 |
| `/hr-dashboard` | HRDashboard | 4 | HIGH | 120 / 3 |
| `/employees` | EmployeeMaster | 4 | HIGH | 211 / 1 |
| `/attendance` | Attendance | 4 | HIGH | 109 / 1 |
| `/payroll` | PayrollModule | 4 | HIGH | 576 / 5 |
| `/items` | ItemsDashboard | 4 | HIGH | 52 / 1 |
| `/admin/export-data` | ExportDataDashboard | 5 | MEDIUM | 13 / 0 |
| `/settings` | Settings | 5 | HIGH | 511 / 1 |

### Route and embedded-feature distinctions

- `/dashboard` uses `components/Dashboard.jsx`; `/ui/dashboard` uses a separate demo in `pages/Dashboard.jsx`. `/ui/customers` is another UI/demo route. Keep both accessible routes without treating demo records as production data.
- `/sales/contracts` is the contract listing/detail experience. New Contract is the existing InvoiceDashboard workflow, also opened through `/sales/invoices?openNewInvoice=1&fromContract=1`. Its fields, saved lead source, numbering and schedule logic stay in that component.
- ScheduleJob is mounted at two paths. TechnicianPortal has five rendered paths and one redirect; preserve explicit job IDs, index aliases, dispatch/detail actions and browser navigation.
- `/whatsapp` and `/certificates` are existing ModuleWorkspace presentations, not complete campaign/certificate management backends. SalesPortal and OperationsPortal also wrap ModuleWorkspace. Preserve their current scope; visual modernization does not authorize inventing operational metrics or functionality.
- Customer details, billing/shipping addresses, service premises, history and import/dedup review are embedded within CustomerDashboard and its children, rather than distinct registered profile routes.
- Contract details contain Overview, Schedules, Payments, Invoices, Material Usage and Site Media views. Renewal tabs/review/letters and source filters are additional state-driven surfaces, not new routes.
- HRDashboard embeds leave requests, allocations and balances. PayrollModule embeds Dashboard, Salary Processing, Salary History, Salary Slips and Settings; these must be included even though there is just one payroll route.
- Settings embeds Profile, GST Company, Non GST Company, Bank Account, Prefixes, Google Integration, Data Health, Terms & Conditions, Change Password, WhatsApp API/Templates/Logs and Email API/Templates/Logs. Several communication components also have standalone routes; test both mount contexts.
- There are no separately registered Users/Roles/Permissions pages in App.jsx. EmployeeMaster includes role and app/web-portal access fields. Preserve that behavior; this project does not authorize building a new access-control system.

## 2. Existing architecture and styling findings

The frontend uses React 18, React Router 6, Vite 8, Axios, Lucide, Recharts, Firebase and react-signature-canvas as declared in the checked-in frontend package. There is no need to add another UI framework or dependency for this redesign. Lazy route loading/retry, authentication interceptors and App Check remain unchanged.

The scan covers **134 JS/JSX/TS/CSS source files**, including **13 stylesheets**, and records **5,695 inline-style occurrences, 72 literal table declarations, 33 window.confirm calls and 115 window.alert calls**. These are source occurrences, not runtime dialog counts. See [source/component inventory](source-component-inventory.csv), [dependency graph](dependency-graph.json), [CSS inventory](css-inventory.json), and [embedded UI candidates](embedded-ui-surface-inventory.csv). The embedded inventory contains 83 state/step candidates, including 20 existing wizard steps; it is not a claim that 83 distinct dialogs were browser-tested.

### Primary consistency problems

1. **Competing theme layers.** index.css has 6,131 lines and 1,485 `!important` declarations. portalDesign.css adds another semantic token/structural layer; App.css contains root rules and arrives through the layout dependency. Across 13 CSS files there are 2,406 `!important` occurrences. Runtime branding then sets root CSS variables. A global replacement would make precedence, dark-mode behavior and branding unpredictable.
2. **Partial component adoption.** A common PageHeader exists, with 14 direct JSX references in 13 files; many legacy pages render private title/actions markup. PageHeader currently accepts title/subtitle/action but no icon slot. Existing chart/attendance/payroll headers need adapters rather than a duplicate header component.
3. **Multiple table systems.** AppTable delegates to ResizableTable; legacy pages frequently use native tables plus useColumnResize. Preserve column IDs, widths, storage keys, sticky behavior, server pagination, action rendering and exports. Do not replace a working table just to use the shared component name.
4. **Different modal contracts.** ui/Modal is a portalled dialog with focus/Escape/outside-click handling; CRMModal and CRMFormModal keep caller-owned policies; many pages hand-build crm-modal-surface headers/bodies/footers. PDF, WhatsApp previews, address pickers, service calendar and technician overlays are specialized surfaces. Sharing appearance must not erase their close, busy, focus or nested-overlay policies.
5. **Inconsistent button and input styles.** AppButton/AppInput/AppSelect exist, but many modules use local style objects and hardcoded colors. Data-dense table inputs need a compact variant; blanket input sizing would break attendance and financial rows.
6. **The app shell already works.** DashboardLayout owns navigation groups, collapsed/sidebar drawer states, saved branding, notifications, manual Service Calendar, settings, theme and logout. The official logo is read from saved branding, with explicit size and object-fit properties. There is no implemented global search or account-dropdown flow to copy from the collage. Preserve existing controls and module-local search; do not introduce decorative controls that imply unsupported features.

### Source evidence to review

- [App routing/authentication](../../frontend/src/App.jsx#L151), [routes](../../frontend/src/App.jsx#L291), [global CSS imports](../../frontend/src/main.jsx#L4)
- [Current semantic tokens and overrides](../../frontend/src/styles/portalDesign.css#L1), [base token layer](../../frontend/src/index.css#L3), [JS token aliases](../../frontend/src/styles/theme.js#L1)
- [Main header](../../frontend/src/components/DashboardLayout.jsx#L785), [logo properties](../../frontend/src/components/DashboardLayout.jsx#L598), [branding application](../../frontend/src/utils/brandingTheme.js#L129)
- [Shared UI exports](../../frontend/src/components/ui/index.js#L1), [PageHeader](../../frontend/src/components/ui/PageHeader.jsx#L1), [ResizableTable](../../frontend/src/components/table/ResizableTable.jsx#L23)
- [Form primitives](../../frontend/src/components/ui/CRMForm.jsx#L7), [wizard](../../frontend/src/components/ui/CRMFormWizard.jsx#L30), [existing general modal](../../frontend/src/components/ui/Modal.jsx#L5)

## 3. Shared-component plan

Reuse the following components, keeping state, validation, API calls and calculations in their current owners. [Usage inventory](shared-component-usage.csv) lists direct named JSX consumers; barrel aliases and dynamic rendering require interpretation.

| Requested role | Existing implementation | Approved-phase proposal |
|---|---|---|
| PageHeader | ui/PageHeader.jsx | Add optional icon/description/action layout variants without changing existing callers. |
| GlassCard / MetricCard | AppCard, DashboardStatCard / SummaryCard | Add restrained surface/density variants; keep values supplied by each page. |
| FilterPanel / SearchInput | FilterBar, SearchBar, AppInput/AppSelect | Shared field/action alignment and stacking; retain draft/apply/reset semantics. |
| DataTable | AppTable → ResizableTable; native tables + useColumnResize | Presentation adapters first; migrate structurally only when column/action/resize parity is proven. |
| StatusBadge | ui/StatusBadge.jsx | Add visual tone support without renaming, merging or translating business statuses. |
| ActionMenu | ui/ActionMenu.jsx | Reuse its portal/position behavior; verify clipping, keyboard access and nested overlays. |
| Primary/Secondary buttons | AppButton / ActionButton | Blue primary, opaque secondary, compact table actions, busy/disabled states. |
| FormField | CRMFormField and AppInput/AppSelect/AppTextarea | Preserve names, validation and labels; align label/help/error presentation. |
| ModalShell / FormWizard | CRMModal, CRMFormModal, CRMFormStep, ui/Modal | Common visual tokens/slots; keep specialized lifecycle and submission contracts. |
| Empty/Loading/Error | EmptyState, LoadingSpinner, LoadingState/ErrorState | Consistent surface and accessible state text; never mask provider/API failures. |
| Pagination | TablePagination + existing page controls | Controlled presentation around current handlers and counts; no new pagination model. |
| Confirmation | ConfirmDialog + existing native dialogs | Migrate per workflow after approval. Do not globally monkey-patch synchronous confirm/alert. |
| Sidebar | Live DashboardLayout, not unused ui/Sidebar.jsx | Modernize the live shell; do not introduce a second navigation implementation. |

The five priority editors already use CRMFormModal: Customer, Contract, Lead, Item and Employee. All currently have four steps. Preserve their fields and step state; Phase 6 should refine shared appearance and the remaining complex forms, not rebuild these workflows. Existing CustomerNameCombobox alignment, free typing, customer resolution and dirty tracking must survive.

### Remaining forms and dialogs

Include quotation creation/items/preview; customer import/dedup/premises; contract schedule builder, customer address picker, numbering/column settings and PDF/share; record payment; vendor/bill/payment editors; stock item/purchase/issue/return flows; complaint assignment/status; technician signature/photo/cost/visit dialogs; attendance audit/location; payroll adjustments/payments/slips and WhatsApp preview; leave entitlement inline controls; marketing audience/template/campaign preview; settings/integration forms and manual Service Calendar overlay. Some are inline panels, not modals. Small inputs and confirmations remain simple; substantial multi-section editors can use the existing wizard after their own field/payload baseline is approved.

## 4. Glass Modern design foundation — proposal only

[Token proposal](design-tokens-proposal.json) contains light/dark colors, dimensions and guardrails. It is not imported or applied to the app. Consolidate into the existing `--ui-*` family; keep legacy variables as compatibility aliases until all consumers have migrated. Saved branding and `--portal-main-header-*` remain separate protected slots. Stage adoption through explicit module/component scopes instead of replacing every global selector.

| Token role | Light proposal | Dark proposal |
|---|---|---|
| Navy | #1C2547 | #111B34 |
| Primary action | #0866FF | #287CFF |
| Page | #F3F6FC | #0B1224 |
| Glass surface | white at 85% | #16213A at 94% |
| Opaque content surface | #FFFFFF | #16213A |
| Text / secondary | #1E293B / #64748B | #E8EEF9 / #A8B7CD |
| Border | rgba(170,190,225,.30) | rgba(150,175,220,.22) |

Use 4/8/12/16/24/32px spacing; 8px controls, 12px cards and 16px modal radii; 42px main controls and 34px dense table controls where appropriate. Keep touch actions usable at 320px. Glass is selective: approximately 10px blur, capped at 12px, with an opaque fallback. Table cells, input interiors, contrast-critical content, maps and print/PDF content remain opaque. No cell-by-cell blur or blanket filtering of scrolling ancestors. Preserve reduced-motion behavior.

[Flat-color contrast estimates](proposed-contrast-checks.json) pass 4.5:1 for the listed text/background pairs, including white on light-theme primary blue. These estimates are **not** an accessibility certification of glass composites, hover/disabled states, charts or current pages; test actual rendered colors during implementation.

**Header/branding boundary:** preserve the official logo asset, source, dimensions and fitting properties. Your prior main-header preference remains the baseline: keep its arrangement and supported controls intact. Phase 2 proposes a navy sidebar and blue active navigation; any main-header visual change must be explicitly included in that phase’s approval. Do not add mock search, profile menus or unsupported shortcuts from the reference artwork.

## 5. Migration sequence and approval gates

| Phase | Deliverable | Gate and scope |
|---|---|---|
| 1 — current | Source/route/component audit, token proposal, migration checklist, before screenshots and baseline checks | Complete; stop here. |
| 2 | Live shell/sidebar and reusable header/card/button/filter/table/modal presentation foundations | Approval required. Preserve main header/logo boundary; verify navigation, drawer and all existing shortcuts. No page-business-logic rewrites. |
| 3 | Dashboard, leads/follow-up, customers, contracts/invoices/quotes/payments, targets/performance and renewals | Separate approval. Migrate by module; financial/selection payload equivalence and retained columns/actions are mandatory. |
| 4 | Service/dispatch/tracking/calendar/complaints, HR/employees/attendance/payroll, vendors and stock | Separate approval. Preserve live GPS, attendance editing, payroll, leave and stock movement semantics. |
| 5 | Marketing, settings/communications, export, Login, workspaces, demo and remaining routes | Separate approval. Preserve credentials/configuration and authentication; safe previews only, no actual sends. |
| 6 | Remaining form/modal consistency and approved complex-editor steps | Separate approval. Inventory every field and validation before changing layout. Small dialogs stay simple. |
| 7 | Final route, workflow, accessibility, responsive/theme and performance regression | Separate approval. No automatic commit, push or deployment. |

For each route: preserve the URL and aliases → record fields/actions/API/columns → adopt shared presentation → compare fixture behavior and payloads → validate desktop/tablet/mobile plus keyboard/dark mode → capture before/after → review. Do not convert source checkboxes into a claim of tested workflows.

### High-risk dependencies and change boundaries

- **Finance:** GST/non-GST, due/paid/rounding, renewal grouping/linking/date guards, target analytics, prefixes and PDF endpoints remain unchanged. Existing renewal work is already dirty; isolate it before any later renewal migration.
- **Customer data:** Maps provider behavior, name resolution, address/premise linkage, duplicate checks, imports and uploads retain their APIs and safeguards.
- **Operations:** preserve route distance/stationary/no-data representation, map layers, tracking subscriptions, calendar/dispatch timing, job evidence and signature handling.
- **HR/stock:** preserve real entitlements/unavailable states, attendance P/A/L/WO and overtime policies, salary processing, inventory units/movements and permission fields.
- **Communication:** saved WhatsApp/SMTP settings, audience building, preview/confirmation and sending logic remain owned by existing modules. Never validate a visual redesign by sending real messages.
- **Popup/scroll behavior:** backdrop/filter/transform creates stacking/containing contexts. Recheck body portals, dropdown anchors, nested dialogs, focus return and sticky action bars before changing those ancestor styles.
- **Print/output:** maintain clean opaque print styles and existing PDF generation; no backend-PDF redesign is included in a frontend glass change.
- **Development baseline:** Dashboard has a hasLoadedRef/active mount guard under React.StrictMode. Development and production preview loading may differ; current screenshots use the production build. Do not silently include lifecycle repairs in a visual migration.

## 6. Verification and evidence

**Executed in Phase 1:**

- Isolated Vite production build: passed; output is under `baseline-build/`, not backend/public. [Build log](validation-results.txt).
- Existing frontend hook/utility tests: **38 passed, 0 failed**. [Test log](validation-results.txt). This includes pre-existing working-tree Renewal tests; it is not evidence that those edits are committed or deployed.
- Source inventory and route cross-check: 78 route entries, 99 literal navigation references resolved. Dynamic paths/queries still require later regression.
- **144 baseline screenshots**: 18 representative page/form views × 1440/1024/768/390px × light/dark. No page or main-content horizontal overflow was measured in those fixture views; visible wizard frames fit the viewport. Zero uncaught page runtime errors and no route error boundary were observed. This does not prove every page, record shape, wizard step or action is correct.
- APIs were intercepted with local fixtures and unrelated external traffic blocked. Three automatic mutation attempts during the page baseline were intercepted (settings save twice; marketing audience preview once). No request was forwarded to production and no production records/messages/settings were changed. No form was filled or saved during baseline captures. The priority-form run is likewise isolated.

[Page baseline results](baseline-visual-results.json), [priority form baseline results](priority-form-visual-results.json), [browser log](validation-results.txt), [form log](validation-results.txt). Screenshots use an explicit “ISOLATED FIXTURES / NOT LIVE DATA” watermark. Fixture branding is not proof of the official logo’s production rendering.

Representative before views: [Dashboard desktop](dashboard-light-1440.png), [Customers desktop](customers-light-1440.png), [Contracts desktop](contracts-light-1440.png), [Invoices mobile](invoices-light-390.png), [Payments dark](payments-dark-1440.png), [New Contract desktop](contractform-light-1440.png), [New Contract mobile](contractform-light-390.png), [Customer form](customerform-light-1440.png), [Lead form](leadform-dark-390.png), [Employee form](employeeform-light-1440.png), [Item form](itemform-dark-1440.png).

Some fixture responses are intentionally partial: for example, Dashboard monthly sales displays its existing unavailable/retry state in the baseline. Empty counts and provider/error states in these captures are not production findings or proof of production data accuracy.

**After screenshots: not applicable — no implementation is authorized in Phase 1.** Authenticated production rendering, live providers/data, real role combinations, browser console/network warnings, full accessibility certification and representative create/edit payload regressions remain unverified in this audit. Existing frontend integration test scripts are not declared in package.json; browser fixtures provide a separate controlled baseline. Backend/security suites were not run for this frontend read-only audit.

### Required validation for later approved changes

At every phase test 1440, 1024, 768 and 390px in both themes, plus a 320px minimum-width pass. Include sidebar collapse/drawer, focus/Tab/Shift+Tab/Escape, programmatic labels, busy/disabled states, validation visibility, nested popups, all table controls, sticky actions, print and reduced motion. Use sufficiently long labels and populated/empty/error states. Add rendered contrast checks and an accessibility scanner/manual review; a successful build is not visual or accessibility proof.

Use isolated fixture workflows for create/edit customer and lead, contract and invoice, payment, quotation, employee, item, stock purchase/issue, vendor bill, complaint and campaign preview. Compare outgoing payloads and computed values with baseline; never exercise production mutation endpoints or real sends. Preserve dashboard data sources, legends, date filters and tooltip behavior. Authenticated read-only QA, if later authorized, must be reported separately from fixture tests.

## 7. Git state, deliverables and next decision

Routes updated: **0**. Shared application components created/modified: **0**. Application files changed by this audit: **0**. Implementation: **pending**. Before captures and proposal documents: **complete**. Later-phase regression and production verification: **not performed**.

Pre-existing worktree state was recorded in [git-status-before.txt](git-status-before.txt): backend/server.js and frontend/src/components/RenewalDashboard.jsx modified; backend/test/renewal-filters.test.js and frontend/src/utils/renewalFilters.js plus its test untracked; 305 untracked backend/public/assets remain untouched. See [final source/status verification](verification.json) for the read-only check. At Phase 1 completion, no staging, commit, push, deploy or database command had been run. The later “push” instruction authorizes publishing this audit package only. The recorded verification.json reflects the read-only audit before this documentation publication; it is not a claim that no documentation commit subsequently occurred.

Deliverables: this report; route migration checklist; source/component and shared usage inventories; embedded UI candidate inventory; dependency graph; CSS inventory; navigation cross-check; proposed tokens/contrast estimates; baseline build/test logs and screenshots. The initial artifacts were prepared outside the repository; this documentation-only copy is published for review. It contains 11 representative screenshots; results cover all 144 captures, with the full image set retained in the original local review folder. Isolated build output is excluded.

**Next recommended phase: Phase 2 — shared shell and presentation foundation, within the main-header/logo boundary above. Await explicit approval before changing application files.**
