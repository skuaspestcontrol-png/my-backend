# Four-form wizard review — local implementation

Completed local implementation and verification on 31 October 2026. The pre-implementation audit is in [four-form-wizard-audit.md](four-form-wizard-audit.md). The approved Customer form remains the design reference.

## Delivered forms

| Form | Steps |
| --- | --- |
| New/Edit Item | Basic Information; Service / Product Details; Pricing & Tax; Review & Save |
| Lead Entry/Edit | Customer Information; Property & Service Details; Assignment & Follow-Up; Review & Submit |
| Add/Edit Employee | Personal Information; Employment Details; Contact & Address; Additional Details & Review |
| New/Edit/View Contract | Customer & Contract Details; Services & Pricing; Contract Schedule & Terms; Review & Save |

All use the existing navy header, outline module/section icons, white animated X, blue active step, persistent panels, responsive navigation and visible action footer. Back/Next retains values, dependent selections and uploaded-file state. Current-step validation shows an inline error and focuses the invalid control. Final submit revalidates all steps and invokes the original save handler. Busy state and a synchronous guard prevent duplicate submissions. Modified Close/Cancel asks whether to discard; untouched forms close without a warning. Review uses the actual draft values and existing calculation helpers.

## Modified and new files

Modified:

- `frontend/src/components/ItemsDashboard.jsx`
- `frontend/src/components/LeadCapture.jsx`
- `frontend/src/components/EmployeeMaster.jsx`
- `frontend/src/components/InvoiceDashboard.jsx`
- `frontend/src/components/ui/CRMFormWizard.jsx`

New:

- `frontend/src/styles/crmFourWizards.css`
- `frontend/docs/four-form-wizard-audit.md`
- `frontend/docs/four-form-wizard-review.md`

The four modules import the scoped stylesheet and reuse the already approved `CRMFormModal`, `CRMFormStep`, `CRMFormStepper`, `CRMFormReview`, native controls and existing custom integrations. The shared wizard adds opt-in submission tracking, dirty confirmation, inline errors, accessible label association and read-only fieldsets. Their defaults retain the approved Customer workflow. No new dependency or competing design system was introduced.

## Screenshots

[Open the interactive screenshot gallery](/private/tmp/skuas-four-wizards/review.html). It offers all four new forms plus Item/Lead/Employee Edit modes, each step, light/dark themes, desktop 1440px, tablet 768px and mobile 390px. Click an image for full resolution. All images show labelled, intercepted QA data.

| Form | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| New Contract | [Step 1](/private/tmp/skuas-four-wizards/contract-new-light-1440-step-1.png) | [Step 1](/private/tmp/skuas-four-wizards/contract-new-light-768-step-1.png) | [Step 1](/private/tmp/skuas-four-wizards/contract-new-light-390-step-1.png) |
| New Item | [Step 1](/private/tmp/skuas-four-wizards/item-new-light-1440-step-1.png) | [Step 1](/private/tmp/skuas-four-wizards/item-new-light-768-step-1.png) | [Step 1](/private/tmp/skuas-four-wizards/item-new-light-390-step-1.png) |
| Add Employee | [Step 1](/private/tmp/skuas-four-wizards/employee-new-light-1440-step-1.png) | [Step 1](/private/tmp/skuas-four-wizards/employee-new-light-768-step-1.png) | [Step 1](/private/tmp/skuas-four-wizards/employee-new-light-390-step-1.png) |
| Lead Entry | [Step 1](/private/tmp/skuas-four-wizards/lead-new-light-1440-step-1.png) | [Step 1](/private/tmp/skuas-four-wizards/lead-new-light-768-step-1.png) | [Step 1](/private/tmp/skuas-four-wizards/lead-new-light-390-step-1.png) |

All-step filename pattern: `/private/tmp/skuas-four-wizards/{form}-{theme}-{width}-step-{1..4}.png`, where form is `contract-new`, `item-new`, `item-edit`, `lead-new`, `lead-edit`, `employee-new` or `employee-edit`; theme is `light`/`dark`; screenshot width is 1440/768/390. Layout checks also cover 1024 and 360px. The gallery includes 168 final screenshots; older debug captures are excluded.

## Verification results

- **645 four-form browser checks passed**, with no runtime errors: Item 90, Lead 93, Employee 94, Contract 96, conditional/integration/accessibility checks 32, and Add-mode layouts 240. This covers 280 step layouts across light/dark and 1440/1024/768/390/360px.
- **284 approved Customer regression checks passed**, confirming its existing defaults, bindings, Add/Edit, navigation, errors, keyboard/motion and responsive layout remain intact.
- **96 financial fixture comparisons passed**. Seventeen existing financial/save/schedule functions are byte-identical to baseline, including totals, payment calculations, line/date changes, invoice numbering, mapping and `handleSubmit`.
- **36 existing frontend utility/hook tests passed**. The isolated production build and `git diff --check` passed. Build output is under `/private/tmp/skuas-four-wizards/build`, not backend assets.
- Source guards verify all four modules retain original non-presentation source, original event callbacks and native/calendar/schedule bindings, apart from the added UI step validators and presentation attributes/imports. Original required/disabled/pattern rules, options and initial values match baseline snapshots in tested Add/Edit modes.
- Item Goods and Service Add payloads exactly match baseline. Edit retains its record ID and retained rate. No price/GST input was invented; the current form supports SAC editing, while Review also displays the existing retained rate.
- Lead retains original aliases, Reference-customer validation/linking, mocked Maps backend search/population, metadata, existing error alerts, Edit ID and notifications/refresh paths.
- Employee retains photo selection across steps, original multipart submission, salary/access values and record ID, conditional password validation, address copying and original explicit document handlers. Password is masked in its control and omitted from the read-only summary.
- Contract retains the invoice-backed model and endpoints. Entire saved payloads match baseline in the GST and Non-GST test cases, including items, numbering, duration dates, schedules and payment records. Edit uses the original invoice ID; View keeps controls disabled and offers Edit without Save. Preferences and address pickers work over the wizard.
- Keyboard focus stays within the active modal; white X hover/leave, 90-degree rotation, reduced motion, existing conditional controls, errors, duplicate-submit protection and unsaved confirmation were exercised.

Financial examples, identical before and after:

| Case | Subtotal | GST | Discount | Round off | Final total | Received | Balance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GST: quantity 2, rate 1000, tax 18% | 2000 | 360 | 100 | 0.50 | 2260.50 | 500 | 1760.50 |
| Non-GST: quantity 1.5, rate 2000 | 3000 | 0 | 50 | -0.50 | 2949.50 | 0 | 2949.50 |

Evidence scripts/results: `/private/tmp/skuas-four-wizards/`. The original baseline was exported from the approved source and served locally. All external browser traffic was blocked; requests used intercepted fixtures. API mutations, uploads and saves were mocked in memory. No production records, provider keys/restrictions, settings or messages were changed.

## Preservation and limitations

The approved Customer source, main navigation/logo, existing global form CSS and theme foundation remain unchanged. Backend APIs, database schemas, accounting formulas, employee access/authentication rules, Maps endpoint/fallback code and original save/update handlers are unchanged.

Line-level start/end/renewal controls remain with their individual service editor in Step 2 so multiple services keep distinct periods; Step 3 contains the schedule builder, payment terms and allocation area. The review reads existing schedule rows and existing tax display values rather than introducing financial or scheduling calculations. The existing invoice/contract shared editor uses the same wizard in its available open modes; the dashboard itself was not redesigned.

Fixture/source verification does not establish live provider ranking, production upload storage, server-side tax behavior or authenticated production success. Existing tax presentation and backend behavior are preserved; this work does not add a new tax regime or change accounting rules. Uploaded-file retention and original request shape were tested locally; production integrations were not exercised.

## Git status and publication boundary

HEAD remains `51c2e696`. The index is empty. These eight rollout files remain local; no commit, push or deployment was performed.

Pre-existing unrelated work remains untouched: `backend/server.js`, the pending filter changes in `RenewalDashboard.jsx`, three renewal-filter implementation/test files and 305 generated assets. The current worktree therefore also contains those prior changes. Stop here for review and explicit publication approval.

Rollout status snapshot:

```text
 M frontend/src/components/EmployeeMaster.jsx
 M frontend/src/components/InvoiceDashboard.jsx
 M frontend/src/components/ItemsDashboard.jsx
 M frontend/src/components/LeadCapture.jsx
 M frontend/src/components/ui/CRMFormWizard.jsx
?? frontend/docs/four-form-wizard-audit.md
?? frontend/docs/four-form-wizard-review.md
?? frontend/src/styles/crmFourWizards.css
```
