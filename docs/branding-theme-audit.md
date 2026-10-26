# Portal branding colour audit

Local review completed 26 October 2026. No deployment or production settings change was performed during the audit.

## Owner controls

Open **Settings → Profile → Branding → Portal Brand Colour**. Select a preset or **Custom**, then **Save Changes**. The existing saved `brandingAccentColor` controls portal chrome and actions; no additional database field or migration is required. Use the existing top-bar theme button for light/dark appearance. Brand colours persist in both modes.

## Findings and fixes

| Finding | Local correction |
| --- | --- |
| Logo area used a fixed purple gradient while the top bar used a theme surface | Both use exactly the saved brand background; removed the separate logo-frame shadow |
| Headers and footers had fixed purple/dark colours | Shared brand tokens now drive page, table, dashboard, modal and pagination chrome |
| Legacy dark rules overrode coloured headers, sticky cells and first/last child footers | Scoped branding rules take precedence over those legacy surface overrides |
| Some invoice, item and email controls used grey, black or fixed blue | Primary actions now use the existing brand token |
| Neutral buttons, selections, focus rings and borders used unrelated colours | Shared brand tint, readable ink and outline tokens now follow the saved colour |
| Arbitrary light/midtone colours could leave white text unreadable | Contrast calculation selects black/white primary text; secondary ink is adjusted against both neutral and tinted surfaces |
| Branding could overwrite the current theme's surface colours | Surface application uses the existing portal theme preference |

The Branding section includes local header/button/footer previews and guidance. Changes follow the existing save, cache and `branding-sync` flow. Light colours use a dark rendering of the existing monochrome portal logo for visibility; the image asset itself is unchanged.

## Scope reviewed

Searched all 79 JSX source files for header/footer roles, primary style objects, inline fixed-colour buttons and shared UI components, together with the shared theme utilities and stylesheets. Added semantic branding attributes to legacy title bars and modal/footer containers.

Local browser coverage: Main Dashboard, Customers, Invoices, Items, Leads, Vendors, Vendor Bills, Settings, Payments Received, Renewals, Employees, Payroll, HR, Contracts, Quotations and WhatsApp Marketing. The shared chrome also serves attendance, follow-ups, tracking, quote creation, preview dialogs and technician workflows; those additional workflows received source inspection, not full browser journey verification.

Success/warning/error badges, destructive actions, chart series and financial KPI semantic colours remain distinct. Data requests, calculations, invoice/PDF generation code, authentication, permission checks, database schema and backend settings persistence code are unchanged.

## Validation

- Isolated Vite production build passed; output remains under `/private/tmp/skuas-branding-review/build`.
- 13 Node regression tests passed: branding tokens, arbitrary-colour contrast, normalization, cache/theme preservation and the existing nine monthly financial summary cases. The primary contrast test samples 4,096 RGB colours.
- 141 fixture-based browser assertions passed across the 16 main modules, both themes, six representative brand colours and widths 320, 390, 768, 1024 and 1440 CSS pixels. Checks include the custom-colour picker, simulated Settings save, branding sync and theme switching.
- 20 additional browser assertions passed for customer/item/vendor/employee modal access, branded headers/footers selected sidebar navigation and preservation of destructive-action colours. Modal footer button contrast was checked separately at 4.5:1 or better.
- Desktop and mobile screenshots were inspected in both themes. Build and browser evidence are in `/private/tmp/skuas-branding-review/`.
- `git diff --check` passed. The existing 305 untracked generated backend assets remain untouched.

## Verification boundary

All browser API calls used an isolated local adapter. Ordinary application writes were blocked; the Settings save test used in-memory responses only. No production endpoint, customer records or live credentials were used. Existing backend support for the saved branding field was inspected, but production persistence and authenticated end-to-end workflows have not been executed. Full live portal sign-off is not claimed.
