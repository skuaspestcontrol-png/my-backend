# Customer master-form pilot — stop for owner review

Scope: implement phases 1–3 of the supplied form-redesign brief locally. Phase 4 (other CRM forms) requires explicit owner approval. No commit, push, deployment, backend change or production write is included.

## Phase 1: audit

The frontend already has shared `ui/Modal`, `AppInput`, `AppSelect`, `AppTextarea`, `AppButton`, `ResponsiveFormGrid`, and `ConfirmDialog`. Several modules also own custom portals, drawers or inline forms with their own submission and close policies. `index.css` repeats modal header/body/footer/control styling and adds dark-mode and branding overrides, including SVG colours. `portalDesign.css` supplies the approved semantic palette.

| Existing form/dialog owners | Existing behaviour to preserve on later adoption |
| --- | --- |
| CustomerDashboard, CustomerPremisesPanel, CustomerImportDedupWizard | Add/Edit, duplicate review/override, premises, address search, import and history are separate flows |
| LeadCapture; ContractDashboard; InvoiceDashboard; QuotationDashboard/CreateQuote; PaymentReceivedDashboard; RenewalDashboard | Assignment, financial and document actions, statuses, relationship eligibility and confirmations stay module-owned; quotation/contract creation reuses existing invoice/editor paths where configured |
| EmployeeMaster; Attendance; HRDashboard; PayrollModule | Employee validation, autosave/time picking, leave entitlements, salary calculations, permissions and existing inline editors |
| VendorDashboard; VendorBillsDashboard; VendorPaymentDashboard; ItemsDashboard | Existing purchase, vendor, item and payment submissions |
| StockItems, StockPurchase, StockIssueUsage; SalesTargets | Existing shared Modal forms and stock/target actions |
| EmailSettings, WhatsAppSettings, EmailTemplates, WhatsAppTemplates; Settings | Existing configuration forms, validation, save state and provider wiring |
| DashboardLayout; PdfPreviewModal; email/EmailPreviewModal; whatsapp/WhatsAppPreviewModal | Operational calendar/preview dialogs have distinct close and action semantics |

Principal regression risks are CSS specificity, footer/form ownership, long-body scrolling, nested duplicate dialogs, disabled submission, controlled selects and refs used by address search. Changing every modal through a global rule would bypass the requested Customer review gate.

Customer Add and Edit share one `showModal` portal in `CustomerDashboard.jsx`. `handleSubmit`, `mapCustomerToForm`, `completeCustomerSave`, `closeModal`, all API calls, validators, address/premises helpers and event callbacks remain unchanged. `closeModal` already rejects closing while saving. Customer Add/Edit had no unsaved-change prompt and did not close on Escape; these policies are retained. Other dialogs keep their existing Escape/confirmation behaviour.

## Phases 2–3: opt-in foundation and Customer pilot

`components/ui/CRMForm.jsx` provides `CRMModal`, `CRMModalHeader`, `CRMModalCloseButton`, `CRMModalBody`, `CRMModalFooter`, `CRMFormSection`, `CRMFormGrid`, `CRMFormField` and `CRMFormActions`. It reuses existing theme tokens and modal surface classes, with additional scoped classes in `styles/crmForm.css`.

The opt-in composition lets the caller keep the native form root, submit handler and footer buttons together. It does not own data, validation, portals, Escape policy or save requests. Only Customer Add/Edit adopts it; the legacy shared Modal and all other form implementations remain unchanged.

- Light header `#1B2342`, dark header `#111B34`; white/light body and `#17243B` dark body.
- Grouped customer details, addresses and additional details; existing premises component retained.
- Two-column desktop fields/address cards, adaptive tablet layout and single-column mobile fields.
- Scrollable body with header and footer outside its scroll region.
- Associated labels for direct native controls and named groups for compound controls.
- Initial close-button focus, focus restoration and Tab containment. Containment yields when an existing duplicate/review dialog opens above the form, preserving keyboard access to that dialog.
- The 40px header-only X stays white, rotates 90 degrees and scales 1.06 on hover using 250ms transitions. It reverses on mouse leave, has a visible focus outline and disables motion under reduced-motion preferences. It calls the existing close handler immediately and is disabled during saving.
- Delete, remove, clear-field, premise-cancel and duplicate-warning icons are not restyled.

## Changed files

- `frontend/src/components/CustomerDashboard.jsx` — only the Add/Edit form presentation adopts the foundation.
- `frontend/src/components/ui/CRMForm.jsx` — opt-in modal/form primitives and white X.
- `frontend/src/styles/crmForm.css` — scoped pilot styling and motion preferences.
- `frontend/docs/customer-form-pilot.md` — audit, implementation and verification notes.

## Verification

Local evidence is under `/private/tmp/skuas-customer-form-pilot`. Browser requests are intercepted with labelled QA data; no production records, real Maps requests or messages are sent.

- **173 browser checks passed**, no runtime errors. Add and Edit were checked at 1920, 1440, 1366, 1024, 768 and 390px, in both themes.
- Header/footer remain visible; body scrolls vertically; controls fit without horizontal overflow.
- Every native field, initial Add value, populated Edit value, dropdown option, disabled/required state and validation attribute matches the untouched baseline.
- The complete Add API payload matches baseline. Mocked Add POST and Edit PUT succeed; Edit values reload, busy controls disable and only one PUT is issued.
- Name/mobile, native email, GSTIN, pincode and numeric-area validation, custom Position, address autocomplete, billing-to-shipping copying, duplicate review and save-failure recovery were exercised.
- Customer Escape behaviour is preserved. The duplicate-review dialog remains keyboard-reachable above the pilot. Header X click, white colour, 90-degree rotation, scale, mouse-leave reset, keyboard focus and reduced motion were checked.
- A separate recording run verified dark hover remains white at 90 degrees and reduced motion removes rotation/transitions. The native browser recording contains 75 actual QA-tab frames; it does not capture the desktop.
- Source guards confirm all non-presentation Customer code, event callback expressions, native-control attributes and CustomerPremisesPanel bindings match baseline.
- **36 frontend utility/hook tests passed.** Production build succeeded in isolated `/private/tmp` output. `git diff --check` passed.

Review artifacts:

- `add-light-1440.png`, `add-dark-1440.png`
- `edit-light-1440.png`, `edit-dark-1440.png`
- `add-light-390.png`, `edit-dark-390.png`
- `x-default-header.png`, `x-hovered-header.png`, dark equivalents
- `white-x-hover.webm`
- `results.json`, `animation-results.json`, test/build logs

Remaining limits: authenticated live Customer saves and real Google Maps/provider ranking were not verified. Existing production data, GST/financial calculations and backend logic were not changed. The earlier pending renewal-filter files and all 305 generated assets are preserved. Other forms have not been migrated; stop here for owner review before phase 4.
