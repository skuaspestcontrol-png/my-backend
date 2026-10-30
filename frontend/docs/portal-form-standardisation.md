# Portal form and popup standardisation

The portal-wide rollout follows the Customer form pilot. The shared layer now styles existing dialog headers, white animated close buttons, body controls and action footers. Main navigation, sidebar logo, routing and saved branding behaviour remain unchanged.

## Implementation

`src/styles/crmForm.css` is loaded once from `src/main.jsx`. Existing modal shells opt into `crm-modal-surface` and named header/body/footer classes; existing inline forms opt into `crm-form-surface`. `CRMModalCloseButton` reuses each original close callback and accessible name. The shared `Modal` retains its keyboard/focus behaviour and renders through a body portal.

Headers use navy in light mode and deep navy in dark mode, 22px titles and a 40px white-X button. Footer controls share spacing, typography, neutral/primary/danger treatments and visible focus states. Close-button motion respects reduced-motion preferences. Long bodies scroll vertically; mobile fields use 16px text. Original field arrangements, dialog widths and financial table scroll regions remain module-owned. Conditional renewal action rows retain their branches and stick within the scroll body.

## Coverage

| Area | Existing surfaces reviewed and aligned |
| --- | --- |
| Customers | Add/Edit, history, duplicate warning/report, import wizard, embedded premises editor |
| Sales | Lead Add/Edit/follow-up, contract summary, invoice/contract editor, invoice number preferences, billing/shipping pickers and address editor |
| Renewals | Details, Edit, assignment, follow-up, outcome and existing/new contract linking branches |
| HR | Employee Add/Edit, Attendance audit/location, payroll Paid/Adjustment, inline leave request |
| Purchasing | Item Add/Edit, vendor Add/Edit, vendor bill forms; payment dashboard has no separate form dialog |
| Stock and targets | Item, purchase, issue, usage, return and sales-target forms |
| Settings | General Settings, Email/WhatsApp configuration and both template editors |
| Operational dialogs | Complaint actions, manual Service Calendar, PDF/Email/WhatsApp previews, shared confirmation |
| Technician | Existing Add Cost shell aligned; its opener has no callers in current source, so verified in source only |

Native browser date/time pickers, action menus and table row editors retain their existing interactions. The unauthenticated Login/password-reset page remains outside this portal rollout. Existing unused HR modal-style declarations do not render a dialog.

The full-form audit also found an existing Renewal Edit rendering crash: status option objects were used directly as React children. Options now render their existing `value` and `label`; selected status values and save handling are unchanged.

## Validation

Local evidence and screenshots: `/private/tmp/skuas-portal-forms/`.

- 35 dialog scenarios and 10 inline-form pages checked at 1920, 1440, 1366, 1024, 768 and 390px in light/dark themes. Dialog checks cover viewport fit, header/close styling, existing close actions and applicable footer styling. Renewal checks also verify the final field scrolls above its action footer. The Usage and Return stock tabs received an additional 24 responsive checks.
- Customer regression: 173 checks passed, including baseline field/payload equivalence, validation, duplicate review, disabled/busy controls and mocked Add/Edit requests.
- Attendance regression: 96 checks passed, including existing editing/autosave behaviour against intercepted local data.
- 36 frontend utility/hook tests passed.
- AST guards passed for 30 module files: non-presentation source, original event callbacks and field bindings match the pre-task snapshot. Main routing/theme foundation files are byte-identical. Shared modal helper changes were reviewed separately.
- Isolated Vite production build and `git diff --check` passed. Build output remains in `/private/tmp`; generated backend assets were not published.

All browser evidence uses intercepted fixture responses; external traffic is blocked. Visual checks block non-GET API requests, and regression saves use in-memory fixtures. No production records, settings, invoices, messages or provider requests were changed. These checks do not establish live production/provider behaviour.

## Pending work preservation

The pre-existing backend/renewal filter changes and generated assets remain uncommitted. Renewal presentation shares a file with that pending work; a separate UI-only patch at `/private/tmp/skuas-portal-forms/renewal-ui.patch` was checked against the current index for later scoped publication. Nothing was staged, committed, pushed or deployed for this rollout.
