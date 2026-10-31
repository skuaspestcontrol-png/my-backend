# Four-form wizard rollout — source audit

Audit completed before implementation on 30 October 2026, starting at `51c2e696`. Scope: Items, Lead Entry, Employee and the invoice-backed Contract editor. The approved Customer form is the design reference and is not being redesigned. No backend, logo, main-navigation, dependency, schema or production changes are authorised. All work remains local pending explicit publication approval.

## Exact owners and current behaviour

| Form | Component and entry | Existing validation and save paths |
| --- | --- | --- |
| New/Edit Item | `src/components/ItemsDashboard.jsx`, `/items`, `showAddModal` | Native required Name plus `handleAddItem` trimmed-name guard. POST `/api/items`; PUT `/api/items/:editingItemId`. Existing service/goods conditional payload clearing remains. |
| Lead Entry/Edit | `src/components/LeadCapture.jsx`, `/leads`, `show` | Native required customer/mobile/service; native email, 10-digit mobile and quotation minimum; `save` checks mobile/WhatsApp, optional six-digit pincode, required reference customer when source is Reference. POST `/api/leads`; PUT `/api/leads/:editingLeadId`. Refresh, notifications, conversions, duplicate warnings and website integration remain owned by the module. |
| Add/Edit Employee | `src/components/EmployeeMaster.jsx`, `/employees`, `showModal` | First name/mobile, ten-digit mobile/emergency contact, optional six-digit pincode; role/access-dependent password requirement. POST `/api/employees`; PUT `/api/employees/:editingId`. Profile photo uses multipart on final save. Existing document upload/delete endpoints retain their explicit workflow. |
| New/Edit/View Contract | `src/components/InvoiceDashboard.jsx`, `/sales/invoices?openNewInvoice=1&fromContract=1`, `showModal` | Customer-name guard; positive-quantity named lines; finite/nonnegative invoice/payment/balance values; payment allocation cannot exceed total. POST `/api/invoices`; PUT `/api/invoices/:editingId`. Shared invoice model, view-only fieldset, preferences/address subdialogs and existing save handler remain. |

## Field inventory and step mapping

- **Items:** Basic: Goods/Service, Name, Unit. Details: conditional About Pest, Pests Covered, Treatment Methodology, Service Description, Frequency, What We Do. Tax: SAC/HSN alias. Review: actual visible values. `form.rate` is already sent by the save handler but has no current visible input; preserve its value without inventing an input. No new mandatory price/GST/category fields.
- **Lead:** Customer: date, New/Existing option, conditional existing-customer selector, customer name, mobile, WhatsApp/same-as-mobile, email, lead source and conditional reference picker/badge. Property/services: existing Maps search, complete address/area/city/state/pincode, pest service, quotation value, property type. Assignment: existing lead status, follow-up date, salesperson, remarks. Review: actual draft. Existing duplicate warning, reference/source handlers and API search remain.
- **Employee:** Personal: generated code, first/last name, gender, birth date, father/mother, marital status, blood group, degree, profile photo. Employment: joining/status/resignation/note, role/manual designation, salary. Contact: mobile, emergency contacts, email, complete permanent/present address and copy checkbox, city/pincode. Additional/review: ID document numbers/uploads, portal access/password controls, bank details, additional documents, actual summary. Password is never rendered in the review. Conditional resignation/access controls and all existing options remain.
- **Contract:** Details: customer type/selection and datalist, addresses/premise pickers, supply/source, number/preferences/date, salesperson and invoice type; subject retained where originally available. Services: complete existing desktop/mobile line-item controls, relationship, description, quantity/rate/tax, duration/frequency/preferred day/service count/dates and add/remove, discounts/round-off/totals. Schedule/terms: existing terms/due-date controls, conditions, ServiceScheduleBuilder and payment allocation area. Review: actual customer/line/tax/totals/schedule values and original save. Line dates remain together with their existing line editor where moving them would split its operational dependencies.

## Dependencies and risks

Reuse the approved `ui/CRMFormWizard.jsx`, `ui/CRMForm.jsx`, `crmFormWizard.css`, existing Lucide icons, native/custom selectors, calendars, address integrations and ServiceScheduleBuilder. Panels must stay mounted to preserve refs, local file selections and dependent state.

Risks: native validity cannot focus hidden panels; Next must never become Submit within one browser event; Leads lacks a busy flag; documents use explicit existing upload operations; Employee access defaults follow role rules; Contract control grids and line tables are wide; view-only mode and nested subdialogs need correct focus/permissions. All original calculations, normalisation, API requests, record IDs and handlers must be source-guarded, with fixture comparisons for final payloads and financial results.

The four forms currently reset/close through module-owned callbacks. The rollout adds opt-in dirty confirmation before user Close/Cancel, without changing successful-save closures or the approved Customer policy. Untouched forms must close without warning. Existing draft/cache and unload semantics remain.

## Execution and approval boundary

Implement/test Item, then Lead, then Employee, then Contract independently. Shared additions are opt-in. Test original fields/defaults/options, conditional paths, step validation, actual review, Add/Edit IDs/payloads, errors, busy/duplicate-submit controls, unsaved confirmation, uploads, keyboard/motion, themes and target widths. Contract tests additionally compare source financial functions and fixture calculations/payloads to baseline. Use only intercepted non-production data. Stop after local testing; no commit, push or deployment.
