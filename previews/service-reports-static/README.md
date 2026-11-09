# Synthetic Service Reports static preview

This standalone preview demonstrates the dashboard, search/status filters, ten canonical report sections, synthetic evidence illustrations, sample signatures, review acknowledgement and report details. Every report, person and address is synthetic. The public company logo is the only existing image reused.

Fields are read-only. Add sample, save and submission actions operate in page memory and are labelled simulations. Reload/reset discards changes. There is no login, backend, API transport, database, camera, gallery, file picker, actual signature capture, PDF generation/download, analytics, remote font, cookie or persistent browser storage. It does not validate the mobile application or unblock QA/AAB release requirements.

## Build and checks

Requires Node.js 18+ only; no install or third-party dependencies.

```sh
node --check previews/service-reports-static/src/model.js
node --check previews/service-reports-static/src/preview.js
node --test previews/service-reports-static/test/preview.test.cjs
node previews/service-reports-static/build.cjs --out /absolute/path/to/EMPTY-preview-output
```

Run from repository root. The builder copies an explicit static allowlist plus public report schema metadata, writes SHA-256 inventory, scans active content and refuses to overwrite populated output. Never upload the repository, backend, package manifests, test files or environment files. Only upload the generated output contents.

The HTML and Apache headers block connection requests, forms, workers, frames and remote resources. Apache additionally disables directory listing and executable/secret extensions. No production secrets, records, uploads, credentials or integration configuration are read by this tool. The schema import contains field definitions only.

## Hostinger manual deployment — instructions only

1. In hPanel, confirm an unused website slot is included in the existing Business plan at no additional charge. Select **Websites → Add website / Create site → Custom PHP/HTML → Start empty**. Create a separate preview website only. Do not select an existing production website, Node.js application, Git integration or auto-deployment branch. Stop if a purchase or upgrade is required.
2. Choose an available included temporary domain, or obtain approval for a new preview subdomain such as `service-reports-preview.skuaspestcontrol.com`. This name is a proposal, not a provisioned or approved endpoint. Do not change production DNS or website mappings. DNS/domain binding and website creation are not performed by this preparation task.
3. Open **the new preview website → Dashboard → File Manager**. Confirm the selected domain and its own document root before writing anything. Upload the static preview ZIP into that new site's `public_html`, extract its contents directly into the root (index.html, .htaccess, robots.txt, schema.js, model.js, preview.js, styles.css, assets/ and preview-manifest.json), then delete the uploaded ZIP. Remove a default placeholder only from this new preview root if it overrides index.html.
4. Require active HTTPS on the new preview hostname before sharing it. Do not configure environment variables, Node.js, a database, credentials, production integrations or backend routes. Do not edit parent/production .htaccess. If a hosting directive is rejected, stop and inspect the new site's error without weakening production settings.
5. Open the HTTPS preview in a fresh browser profile. Check the dashboard, filters, all ten wizard steps, sample evidence/signatures, review acknowledgement, simulated submission, details, light/dark and mobile layout. Confirm DevTools Network contains only same-site static GET requests and no API, WebSocket, POST or external requests. Check CSP, nosniff, noindex, DENY and Permissions-Policy response headers. Verify JavaScript/CSS/images return correctly and .env/backend routes are absent. Browser runtime/visual review is a deployment acceptance gate, not claimed by the local unit tests.
6. Rollback only this new preview: remove its allowlisted output files or disable its new website after approval. Never remove a parent/production root, database, DNS mapping or existing website. No production rollback is needed because production is unchanged.

Static-only content contains no customer data but is not an access-control mechanism. Shared hosting does not isolate backend secrets; full QA backends and the Expo AAB remain on hold. Do not add real records, forms, endpoints or secrets to this preview.

## Local validation record — 2026-11-09

- 14/14 isolated Node build/model/security tests pass; no HTTP listeners, MySQL, integrations or production environment configuration loaded.
- Ten-section schema parity, synthetic records, search/status filtering, unique demo IDs, acknowledgement, approved-state mutation prevention, internal-note exclusion, HTML escaping, allowlisted artifact hashes, CSP and negative security scanner cases are covered.
- JavaScript syntax checks pass. Output has 12 static files; no backend or dependency bundle.
- Browser screenshot validation is UNVERIFIED: Chrome could not launch under the managed environment. No broader-permission retry or localhost server was used. Perform step 5 before accepting visual/runtime behavior.
- No hosting, DNS, database, production settings, QA backend or Expo build changes are included.

Hostinger references: [Add a website](https://www.hostinger.com/support/1583214-how-to-add-a-website-in-hostinger/), [File Manager](https://www.hostinger.com/support/4548688-basic-actions-in-the-file-manager-in-hostinger/).
