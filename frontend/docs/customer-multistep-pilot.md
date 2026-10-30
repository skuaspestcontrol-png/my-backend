# Customer multi-step pilot — stop for approval

This implements phases 1–2 of the Unified Multi-Step Forms brief. Customer Add/Edit are the first adopters. Other forms keep their existing workflows until approval of this pilot. The earlier portal styling work and unrelated pending changes are retained; this pilot has not been staged, committed, pushed or deployed.

## Existing form audit and migration plan

The earlier inventory in `customer-form-pilot.md` and `portal-form-standardisation.md` identifies the existing custom portals, shared Modal and inline forms. This iteration reuses `CRMModal`, its header/close/body/footer, `CRMFormSection`, `CRMFormGrid`, `CRMFormField`, and the existing theme tokens. Native select/date/search controls are retained rather than replaced with new data-owning widgets.

| Form owner / location under `src` | Fields, validation and dependencies to preserve | Migration boundary / risk |
| --- | --- | --- |
| `components/CustomerDashboard.jsx`, `CustomerPremisesPanel.jsx` | Segment, company/contact/display name, position/custom position, mobile/WhatsApp/alternate/email; GST toggle/GSTIN; billing/shipping attention/address/area/city/state/pincode; numeric area; existing premises editor. Existing names/mobile/GSTIN/pincode/coordinate validation, native email/pattern rules, Maps search, copy billing, duplicate review and payload normalisation | Pilot only. Keep all controls mounted, including the premises editor; preserve native attributes, handlers and final POST/PUT |
| `components/LeadCapture.jsx` | Customer/contact details, mobile/WhatsApp/email, address search/property, service/assignment/follow-up controls and existing validation | Next approved phase; preserve relationships, source selection, autocomplete and follow-up actions |
| `components/VendorDashboard.jsx`, `VendorBillsDashboard.jsx` | Vendor contacts/addresses/GST and existing bill dates, items/taxes/payment fields; current native/custom validation | Vendor after Lead; bills treated separately because of purchase totals and records |
| `components/EmployeeMaster.jsx` | Employee ID, names/contact, role/access, employment/salary and existing document controls; first-name/mobile requirements and password requirement when access is enabled | After Vendor; preserve identity, file upload handling, roles and payroll dependencies |
| `components/ItemsDashboard.jsx` | Goods/service type, required name, pest/service description, treatment/frequency, unit, SAC/HSN and other conditional fields | After Employee; short variants should retain a single panel |
| `components/ContractDashboard.jsx`, `InvoiceDashboard.jsx` | Existing contract/invoice editor paths, customer/premise/service relationships, duration/scheduling, numbering, GST, totals, addresses and payment splits; current eligibility and save guards | Separate approved financial phase; do not remap calculations, relationships or unsaved-change warnings |
| `components/QuotationDashboard.jsx`, `CreateQuote.jsx` | Dashboard opens `/quotations/new`; dedicated editor retains source/customer/lead/premise, quotation number/date/validity, services, recommendation tables, quantity/rate/GST/totals, terms, Draft/Final and PDF preview | Separate approved phase. This editor is independent; do not replace it with the invoice editor |
| `components/PaymentReceivedDashboard.jsx`, payment controls in `InvoiceDashboard.jsx` | Payment dashboard records and existing invoice-linked allocations/splits, amounts, dates, modes and bank accounts | Separate approved financial phase; no invented standalone payment workflow |
| `pages/stock-management/*`, `pages/sales-performance/SalesTargets.jsx` | Existing stock item/purchase/issue/usage/return and target forms, required controls, quantities and existing submit handlers | Reuse visual primitives; do not change inventory or target calculations |
| `components/HRDashboard.jsx`, `PayrollModule.jsx`, `RenewalDashboard.jsx` | Leave request/allocation, payroll adjustments/outcomes, renewal assignment/follow-up/outcome/linking and their current permissions/validation/audit semantics | Preserve inline table editors; financial/outcome actions require individual verification |
| `components/Settings.jsx`, `pages/settings/*`, operational preview/dialog owners | Existing configuration/provider fields, templates, permissions, save/test/preview/send actions | Keep short dialogs short; no automatic provider calls or settings saves on step navigation |

The principal structural risks are hidden native validation targets, accidental saves when Next changes into Submit, resetting embedded drafts by unmounting panels, nested duplicate-dialog focus, and changing financial state while reorganising JSX. The pilot explicitly tests the first five; financial modules are not migrated here.

## Pilot design and behaviour

The new opt-in `components/ui/CRMFormWizard.jsx` provides `CRMFormModal`, `CRMFormStep`, `CRMFormStepper` and `CRMFormReview`. Styling lives in `styles/crmFormWizard.css`; the existing global form CSS is unchanged. The existing header helper accepts an optional module icon, and the field helper supports a visual/accessibility required hint without changing native validation rules.

Customer uses:

1. Basic Information — existing contact/company controls. A company **or** contact person is required; both are not made mandatory. Mobile retains its existing 10-digit rule.
2. Address Information — existing search/autocomplete and complete billing/shipping controls, including Copy billing address.
3. Additional Details — existing GST, numeric area and premises editor.
4. Review — a read-only summary, with the original Save Customer/Update Customer action.

All panels remain mounted. Back and visited-step navigation preserve parent form values, refs, autocomplete state and embedded draft state. Unvisited steps cannot be skipped. Forward navigation validates the current panel's native controls plus its existing customer rules. Final save revalidates every panel, reveals/focuses any invalid step, and invokes the unchanged `handleSubmit` only after validation.

The modal uses `noValidate` because native browser submission cannot focus an invalid control in a hidden panel. The wizard reads each native control's validity, reveals its panel, and calls `reportValidity`; validation attributes and native email/pattern semantics remain intact. Original final custom validation remains in place.

Next and Submit have distinct React keys so a Next click cannot become a native submit during the same browser event. A synchronous submission guard blocks duplicate submits, and existing busy state disables step navigation, Close, Cancel and Back. No partial customer save is introduced. Existing explicit premises operations retain their original semantics; preparing a new-customer address remains local until the original save workflow.

The original Customer close and Escape policies are retained. Original save/duplicate/error handlers, API paths, payload construction and all field bindings are unchanged. The new step validation calls the same existing normalisers and validators. Header/step focus, Tab containment and nested dialog access remain available.

Desktop uses left navigation; tablet uses a compact rail and adaptive fields; mobile uses a compact horizontal step list, single-column fields and an always-visible action footer. Step changes animate for 180ms and respect reduced motion. The white header X retains its existing 250ms rotation, scale and focus styling. Main navigation, logo and official branding assets are untouched.

## Verification

All evidence is local under `/private/tmp/skuas-multistep`. Browser requests use intercepted QA fixtures; external traffic is blocked. Customer POST/PUT operations are in-memory test responses. No production records, settings, messages or Maps provider requests were changed.

- 284 browser checks passed, with zero runtime errors. Add and Edit, all four steps, light/dark, and widths 1920/1440/1366/1024/768/390/360px were checked.
- Field/default/option/validation snapshots match the prior form (allowing GST's move into Additional Details).
- Required name/mobile, native email and pincode validation, GSTIN, numeric sanitising, custom position, mocked Maps autocomplete and billing copy passed.
- Back/Next and visited-step navigation preserve values; invalid edited steps cannot be bypassed; Review and navigation produce no customer writes.
- One Add POST despite double click; Edit PUT retains untouched address values; saved Edit values reload. Busy controls, duplicate review, API-error recovery, focus/Tab behaviour, the original Escape policy, X hover and reduced motion passed.
- 9 additional embedded-premises checks passed: the unsaved editor survives Back/Next and Review, fields fit at 1440/768/390/360px, preparing an address remains local, and Review reflects the prepared count. Evidence is in `premises-results.json`.
- Source guards confirm every original non-presentation Customer statement, event callback, native control attribute, dropdown expression and premises binding is unchanged, apart from the new step-gating function and presentation imports. Existing global form CSS is byte-identical to the pre-pilot snapshot.
- All 36 existing frontend utility/hook tests passed. Isolated production build and `git diff --check` passed.

Screenshots include Add/Edit, all steps, desktop 1440px, tablet 768px and mobile 390px in both themes. Examples:

- `/private/tmp/skuas-multistep/add-light-1440-step-1.png`
- `/private/tmp/skuas-multistep/edit-light-1440-step-4.png`
- `/private/tmp/skuas-multistep/add-light-768-step-2.png`
- `/private/tmp/skuas-multistep/add-light-390-step-1.png`
- `/private/tmp/skuas-multistep/edit-dark-390-step-4.png`

This is fixture-based UI/workflow verification, not authenticated production/provider proof. Customer has no existing file-upload control; Employee uploads and financial totals/drafts require their own tests in the later phases.

## Approval gate

Stop here for Customer pilot review, as requested by phase 2 of the supplied brief. Lead/Vendor, then Employee/Items, and the separate Contract/Invoice/Quotation/Payment phases remain pending. No publication is included.
