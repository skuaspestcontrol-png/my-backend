# Dashboard charts UI review — 28 October 2026

Implemented and locally verified. Source publication was approved by the owner with “push”. Production deployment and live financial verification are outside this review.

## Scope and diff

- `frontend/src/components/Dashboard.jsx`: replaces the pipeline progress display with a Recharts funnel and the source donut with horizontal bars. Adds existing Lucide icons to the five chart headings. Uses the original source series, order, mapped labels, colours, counts and percentage expressions directly.
- `frontend/src/components/Dashboard.css`: adds scoped Soft Analytical surfaces, heading/icon styling, tinted summary tiles, wrapping source labels, responsive layout and dark-theme overrides. Two columns at desktop widths; Sales Team Performance remains full width. Narrow-phone summary tiles stack to preserve readable amounts.
- This review document.

The two frontend files total **147 insertions / 83 deletions** relative to `341d30b8`. No application dependencies were added.

## Preserved behaviour

Six byte-level preservation checks pass against the original component:

1. API calls, parameters, hooks, state/cache, refresh subscriptions/timing, business calculations, reporting dates, filters and category mapping.
2. Existing mobile tooltip and currency formatting.
3. Monthly chart rendering adapter, expense donut and all dashboard markup above the chart grid.
4. Income/expense totals, both monthly series, axes, tooltips and handlers.
5. Top Expenses populated/empty conditions, category values and existing top-five dataset definition.
6. Sales selectors, totals, monthly target/achievement comparison, colour rules, tooltips and loading/empty handling.

All three pipeline label buttons retain navigation to `/leads`. Existing dashboard cards, shell/navigation and Service Calendar source are unchanged. No Recent Activities section was added.

## Verification

- Isolated production Vite build: **PASS**. Output went to `/private/tmp/skuas-soft-charts-review/build`; generated `backend/public` assets were not changed.
- Existing frontend utility/hook tests: **28 passed, 0 failed**.
- Before/after browser suite: **56 passed**. Synthetic populated, empty, zero, missing-data, error and delayed/loading cases produce identical data snapshots and API request signatures. Year and salesperson changes retain their original requests and datasets. All ten supplied source categories, including extra and long labels, render. Both financial series and sales green/red comparison colours render.
- Interaction/resize suite: **21 passed**. Desktop hover and phone tap tooltip values match the baseline for both finance charts. Source-total contrast checks pass in both themes. Responsive chart repaint checks pass.
- Final capture run checks page overflow at **320, 390, 768, 1024 and 1440px**, in light and dark themes. Browser runs reported no uncaught runtime exceptions.
- `git diff --check`: **PASS**.

Harness, synthetic records and machine-readable results are outside the application repository:
`/Volumes/skuas/Projects/design-previews/soft-charts-review/`.
All non-local browser HTTP requests were blocked and the Axios adapter rejected writes. No production endpoints, credentials or real customer/employee records were used.

## Screenshots

Design preview — sample data. Desktop/tablet images use separate upper/lower views to show charts at normal viewport heights. Mobile images show the stacked layout in normal-height viewport captures. Additional income, source and sales images avoid a headless full-page capture artefact that can reset offscreen responsive charts.

| View | Light | Dark |
| --- | --- | --- |
| Desktop 1440 | [Upper](../../design-previews/soft-charts-review/light-1440.png), [lower](../../design-previews/soft-charts-review/light-1440-lower.png) | [Upper](../../design-previews/soft-charts-review/dark-1440.png), [lower](../../design-previews/soft-charts-review/dark-1440-lower.png) |
| Laptop 1024 | [Upper](../../design-previews/soft-charts-review/light-1024.png), [lower](../../design-previews/soft-charts-review/light-1024-lower.png) | [Upper](../../design-previews/soft-charts-review/dark-1024.png), [lower](../../design-previews/soft-charts-review/dark-1024-lower.png) |
| Tablet 768 | [Upper](../../design-previews/soft-charts-review/light-768.png), [lower](../../design-previews/soft-charts-review/light-768-lower.png) | [Upper](../../design-previews/soft-charts-review/dark-768.png), [lower](../../design-previews/soft-charts-review/dark-768-lower.png) |
| Mobile 390 | [Pipeline](../../design-previews/soft-charts-review/light-390.png), [income](../../design-previews/soft-charts-review/light-390-income.png), [sources](../../design-previews/soft-charts-review/light-390-sources.png), [sales](../../design-previews/soft-charts-review/light-390-lower.png) | [Pipeline](../../design-previews/soft-charts-review/dark-390.png), [income](../../design-previews/soft-charts-review/dark-390-income.png), [sources](../../design-previews/soft-charts-review/dark-390-sources.png), [sales](../../design-previews/soft-charts-review/dark-390-lower.png) |
| Mobile 320 | [Pipeline](../../design-previews/soft-charts-review/light-320.png), [income](../../design-previews/soft-charts-review/light-320-income.png), [sources](../../design-previews/soft-charts-review/light-320-sources.png), [sales](../../design-previews/soft-charts-review/light-320-lower.png) | [Pipeline](../../design-previews/soft-charts-review/dark-320.png), [income](../../design-previews/soft-charts-review/dark-320-income.png), [sources](../../design-previews/soft-charts-review/dark-320-sources.png), [sales](../../design-previews/soft-charts-review/dark-320-lower.png) |

## Limits and outstanding review

Local synthetic-data equivalence does not establish production financial accuracy or authenticated production behaviour. Existing fallback/coercion behaviour is preserved, including any inherited missing-value handling; this presentation task does not redefine those rules. The preview intentionally uses ten source categories to stress wrapping, so it is taller than the three-category reference. Funnel geometry derives from existing counts, not sample-image proportions.

Transient Recharts container-size warnings occurred during initial sizing/viewport transitions in the isolated harness; visible-bar and repaint checks passed after layout settled. The screenshots and harness remain local review artifacts; their links require this workspace. Unrelated generated assets remain untouched. No backend logic, records, permissions, migrations or financial calculations were changed.
