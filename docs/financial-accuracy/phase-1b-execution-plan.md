# Phase 1B — corrected SELECT-only audit preparation

Readiness: local review preparation PASS; execution HOLD pending approval, verified SELECT-only access, a stable snapshot, and engine/schema review. No database was contacted and no SQL was executed, locally or in production. This phase changes documentation/audit SQL/tests only. Application calculations, monthly rounding fix, yearly figures, statuses and employee mappings are untouched.

## What changed

The companion file remains 21 statements with stable IDs S01–S21, now physically separated into Batch A (4), B (5), C (12). IDs preserve the former sequential statement references; physical execution order is now A, B, C, so S08 is in C rather than between S07 and S09.

- S07 includes NULL invoice dates in an explicit `UNALLOCATED_MISSING_ISSUE_DATE_ALL_PERIODS` bucket. That bucket spans the entire snapshot, not a guessed month/year. Other rows are split into selected month and other months in the selected year. The misleading year-filtered missing-date counter has been removed.
- S07/S09/S10 use the identical embedded classifier, also shared by S08. Non-empty table invoice_status has precedence over payload status only when they do not conflict. Missing table status falls back to a payload STRING. Conflicting values, invalid JSON/non-object payloads, non-string status values and unknown/missing statuses are explicit exceptions. Invalid payloads are guarded before JSON extraction. Comparison to the diagnostic vocabulary uses binary casts so accent-insensitive collations do not accidentally recognise or print arbitrary unknown labels.
- Diagnostic vocabulary is not an eligibility allowlist. SENT/PAID/other recognised labels describe data only; no status is certified eligible. Verified eligible-sales amounts are NULL with `UNVERIFIED_STATUS_MAPPING_AND_AMOUNT_BASIS`, even if every row says SENT or PAID. Owner policy remains issued invoice sales regardless of collection, excluding drafts/voids/cancellations, with verified adjustments and canonical identities.
- S09/S10/S19/S21 explicitly label persisted-column totals as provisional. They are not API GST-inclusive achievement, final owner-policy eligible sales, or net sales. No payment table is read. API gross precedence, discounts, withholding and round-off still require reconciliation.
- Empty monetary aggregates stay NULL instead of being coalesced to ₹0. Explicitly configured zero targets remain distinguishable from no target rows. Missing/negative target amounts and missing ledger values have exception counts. S19 returns NULL omitted-money totals if an omitted invoice amount is missing. Adjustment totals remain NULL/UNVERIFIED until the real model is known.

## Three audit batches and cost gates

All financial/data-quality queries require ONE immutable, authorised audit snapshot, not merely a replica that continues changing. Capture its watermark and schema revision. Do not run the whole file unattended or concurrently. Costs are qualitative, not measured timings or query-plan evidence.

| Batch | Statements | Expected output | Snapshot / expected cost |
| --- | --- | --- | --- |
| A: Metadata | S01–S04 | Engine/version and timezone labels; base-table columns, collation/engine, indexes and FK metadata | Metadata only, generally low cost. Recheck if schema changes. No application connection hooks. |
| B: Financial baseline | S05, S06 | Raw configured monthly/year targets, counts, configuration/amount/scope flags | Stable snapshot; low–moderate target scan. Monthly target missing = TARGET_NOT_CONFIGURED with NULL amount. |
| B: Status baseline | S07 | Selected-month / other-year-month status counts plus global unallocated NULL-date bucket; provisional amounts; NULL eligible sales | Stable snapshot; potentially HIGH full scan/JSON work because NULL dates from all periods are included. Review read budget before execution. |
| B: Ledger baseline | S09, S10 | Month/year canonical counts, provisional persisted totals, status/missing-amount exception counts, NULL eligible sales | Stable snapshot; moderate–high year-range/JSON work. Date index may help, but nested derived-table optimisation is engine/version dependent. |
| C: Exceptions | S08 | Global missing dates and mutually exclusive status/payload exception counts | Stable snapshot; HIGH full invoice/JSON scan. Conflicts on rows with invalid payload/type are classified into those higher-priority exceptions; counts must not be interpreted as independent overlapping inventories. |
| C: Identities | S11–S13 | Repeated business-number, external-identity and active-target-period counts | Stable snapshot; S11 HIGH expression grouping/sorting, possibly disk temporary work; S12 index scan (can defer if unique index confirmed); S13 target grouping. Repeated numbers do not automatically justify excluding distinct canonical IDs. |
| C: Employee attribution | S14–S16 | Unmatched/ambiguous stable target references; name collision counts; invoice ID-key presence/invalid payload counts | Stable snapshot; S14 potentially HIGH correlated employee scans due to casts/OR; S15 regex/JSON/grouping; S16 HIGH full invoice/JSON scan. Key presence is not valid ID resolution. |
| C: Adjustments | S17 plus discovery from A | Candidate credit/refund/reversal-key counts and NULL verified sales adjustments | Stable snapshot; HIGH full JSON scan. No keys or no FKs is not proof that no adjustments exist. |
| C: Completeness | S18, S19 | Full invoice count and per-month missing counts/provisional value outside the GLOBAL newest-4000 window | Stable snapshot; index count and year scan joined to newest 4000 IDs. Actual missing-date rows remain unallocated. Investigate the separate employee 3000 cap when matching is reviewed. |
| C: Dates / amounts | S20, S21 | Timestamp/date disagreement and invalid-payload counts; limited persisted-vs-subtotal+tax variance | Stable snapshot; HIGH JSON/regex/decimal cost. S21 may round sub-paise/overflow values; diagnostics remain UNVERIFIED. |

Minimum execution progression after approval: A first; then B only after capability/schema/privacy/access gates; then C one statement at a time within an approved read budget. C can be split across review sessions on the same immutable snapshot. A+B is an initial baseline, not complete financial sign-off. No declared row limit, time or millisecond estimate is a measured performance guarantee.

## Engine and MariaDB compatibility assessment

**Production engine/version is unknown.** The application uses mysql2 and its DDL includes JSON, but neither proves MySQL 8. Hostinger documents MariaDB for standard Web/Cloud plans; this CRM may use a different database service. No production query was used to decide.

**Conservative syntax/capability floors for the full prepared file:** MariaDB 10.2.7 or later; MySQL 8.0.11 or later. These are preparation boundaries, not claims of runtime testing, vendor maintenance support or an instruction to deploy an obsolete server. Both floors are old; an approved supported release and an offline vendor/version-matched validation remain prerequisites. Older versions require a separately reviewed adaptation; do not upgrade production to run the audit.

| Construct | Repository / compatibility assessment | Required gate/adaptation |
| --- | --- | --- |
| SELECT, CASE, derived/scalar subqueries, GROUP BY, COUNT/SUM, CAST DECIMAL/BINARY, date boundaries | Common SQL constructs; repository already uses aggregate SELECTs, JSON columns, date/numeric fields and `LIMIT`. No CTEs, window functions, JSON_TABLE, JSON arrow operators, CAST AS JSON, routine definitions or engine hints added. | Verify actual base-table columns, DATE vs timestamp types, indexes, DECIMAL ranges and SQL mode. S14 casts can defeat index access. |
| JSON_VALID, JSON_EXTRACT, JSON_TYPE, JSON_UNQUOTE, JSON_CONTAINS_PATH | Supported by MariaDB 10.2 family and modern MySQL. Not exclusive to MySQL 8. MariaDB JSON is a LONGTEXT alias; MySQL native JSON storage differs. Runtime JS JSON.parse is not SQL JSON semantic equivalence. | Validate real payload type/encoding. The file guards malformed documents; invalid/non-object status payloads are exceptions. JSON key presence is diagnostic only. Case, duplicate JSON keys, escapes, JSON null and string values require vendor-matched test fixtures before execution approval. |
| REGEXP_REPLACE (S15) | Available in MariaDB (PCRE); introduced in MySQL 8.0.4, absent in MySQL 5.7. This is the principal MySQL-8-era function in the file, not a MariaDB-incompatible function. | No engine assumed. On an older unsupported engine, defer S15 or propose a separately reviewed aggregate alternative; do not install UDFs/routines. |
| REGEXP patterns (S15/S20/S21) | MariaDB uses PCRE; MySQL 8 uses ICU. Patterns intentionally use basic character classes and anchors. | Collation, Unicode and whitespace semantics differ from JS normaliseMatchKey. Name collision query is a diagnostic, never an ownership join. A binary cast is used for status comparisons, not regex subjects (avoids MySQL's binary-regex restrictions). |
| information_schema columns/indexes/FKs and @@ time_zone labels | Common metadata, visible only within granted access. No privilege tables, account names or passwords requested. | Missing visibility is UNVERIFIED, not proof that tables/constraints are absent. Non-InnoDB tables need a separately reviewed operational read plan. |
| CONVERT_TZ with explicit offsets (S01) | Uses built-in numeric offsets rather than named-zone tables. DATE values are never shifted. | SQL timezone does not establish Node's process timezone. S20 is provenance only, not full date regrouping. |
| Decimal casts and sums | Persisted DECIMAL aggregates differ from JS Number arithmetic; S21 explicitly casts common payload fields to DECIMAL(18,2). | A cast can round/overflow and warnings must be reviewed privately. Do not use these sums as certified API parity or recompute API percentage with SQL ROUND. |

No SQL construct in the file is intentionally MySQL-only at the declared floors. The file parses under SQLGlot's MySQL grammar, but SQLGlot has no separate MariaDB runtime here. A parser success is not MariaDB execution, schema verification or permission confirmation.

Primary reference sources reviewed during preparation:
- MariaDB JSON_EXTRACT: https://mariadb.com/docs/server/reference/sql-functions/special-functions/json-functions/json_extract
- MariaDB JSON_CONTAINS_PATH: https://mariadb.com/docs/server/reference/sql-functions/special-functions/json-functions/json_contains_path
- MariaDB JSON type: https://mariadb.com/docs/server/reference/data-types/string-data-types/json
- MariaDB REGEXP_REPLACE: https://mariadb.com/docs/server/reference/sql-functions/string-functions/regular-expressions-functions/regexp_replace
- MariaDB 10.2 function comparison: https://mariadb.com/docs/release-notes/community-server/about/compatibility-and-differences/function-differences-between-mariadb-and-mysql/function-differences-between-mariadb-and-mysql-unmaintained-series/function-differences-between-mariadb-102-and-mysql-56
- MariaDB 10.2.7 stable release: https://mariadb.com/docs/release-notes/community-server/old-releases/10.2/10.2.7
- MySQL 8.0.4 regex additions: https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-4.html

## Concise execution checklist — future action only

1. Obtain explicit approval for the selected batch and read budget. Do not connect or execute now.
2. Obtain a DBA-approved immutable audit copy/watermark and a dedicated SELECT-only principal. No application credentials, privileges/permission changes, migrations or backfills are part of this preparation. Hostinger standard one-user-per-database arrangements may require an isolated copy; never make the live application's user read-only.
3. Confirm effective grants, verified TLS, no client/server/application initialisation hooks, and approved ordinary nonlocking read behaviour. Use direct base tables and information_schema, never application GET routes, ORM startup, stored routines, views, server-side exports, session changes or locks. Server logging/temp files/resource use are possible; SELECT-only does not promise zero operational impact.
4. Review all example literals together: month 10, October boundaries and year 2026; calendar year is not a financial-year assumption. Never assign missing dates to the selected period.
5. After approval, A verifies the engine/version, base-table schema, collation, index and metadata visibility. Stop on unsupported functions/schema; do not mutate schema for compatibility. Validate the SELECT text on a separately approved disposable vendor/version-matched copy before B/C. That validation has NOT been performed here and is not authorised by this preparation task.
6. Execute only approved statements serially against the same stable snapshot. Stop on time/resource budget, invalid amounts, warnings, inconsistent counts or schema/version changes. Do not print raw warnings containing data, payloads, customer/employee names, invoice numbers or identifiers. No mutation-based privilege test.
7. Store aggregate results in restricted storage. Status vocabulary outputs are bounded categories; employee names/IDs are used internally only. Money totals are still confidential, and small groups can reveal individual values by inference. Use redacted/suppressed small-cell versions for wider sharing; the authorised financial reviewer may need full aggregates.
8. Report NULL plus UNVERIFIED/BLOCKED without formatting it as ₹0. An empty grouped result is NO_MATCHING_ROWS, not evidence of missing funds or a certified ₹0 achievement. Distinguish explicit configured-zero targets from no configuration, missing amounts, unknown status mapping and incomplete adjustment/mapping evidence.
9. Resolve exception counts and scope/amount/date/adjustment assumptions with the owner. Only a separately reviewed SELECT-only policy computation can produce verified eligible/net achievement. Do not alter application calculations or historical records.

## Expected aggregate-only report

Header: snapshot watermark; engine/version; schema/query revision; reviewed period; scope; business timezone; batches/IDs executed; elapsed/read-budget observations; approval reference. No account/host credentials or personal/document identities.

| Metric | Selected month | Calendar year | Verification / exceptions |
| --- | --- | --- | --- |
| Raw target row count / amount | count; amount or NULL | type-separated raw amount | explicit zero / not configured / invalid / scope unverified |
| Canonical invoice count / persisted ledger sum | count; provisional amount | count; provisional amount | missing amount count; NOT API achievement |
| Status bucket counts | selected-month counts | year buckets | conflicting/unknown/invalid separately; no eligibility inferred |
| Unallocated missing issue dates | NOT_ASSIGNED | all-period count only | do not add to the selected month/year |
| Eligible GST-inclusive sales | NULL | NULL | UNVERIFIED_STATUS_MAPPING_AND_AMOUNT_BASIS |
| Valid sales adjustments / net sales | NULL | NULL | UNVERIFIED_ADJUSTMENT_MODEL until relationships are verified |
| Repeated numbers / canonical IDs / target groups | aggregate counts with scope | aggregate counts with scope | collision is not an automatic duplicate exclusion |
| Unmatched / ambiguous employee IDs | count | count if separately reviewed | legacy names/key presence are not proof of attribution |
| Global-cap omissions | count; provisional amount or NULL | monthly evidence / year bridge | missing amounts and unknown dates separately |
| Amount/date discrepancy counts | diagnostic count/delta | diagnostic count/delta | preserve overlap; do not blindly sum exposure |
| Final result | HOLD | HOLD | metadata/scope/status/amount/adjustment/date/cap gates unresolved |

## Local validation and limits

- 21 statements parsed as SELECT ASTs using SQLGlot 30.24.0, MySQL dialect. No connection/SQL execution occurred.
- 11 offline structure/safety regressions verify batch membership/count, mutation/routine/table allowlists, status classifier identity/exception precedence, explicit unallocated NULL dates, NULL financial placeholders, JSON guards, no raw personal/JSON report projections and global-cap semantics.
- This is static validation only: not a server parser, vendor-version integration run, performance measurement, live schema check or production financial reconciliation.
- Application financial files are hash-checked against the start of Phase 1B. Existing generated assets are preserved. No commit, push, deployment or production access.

Reproduce static tests with a temporary parser installation (no repository dependency changes, no database driver):

```sh
python3 -m pip install --target /private/tmp/skuas-finance-phase1b-parser sqlglot==30.24.0
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/private/tmp/skuas-finance-phase1b-parser python3 -m unittest discover -s docs/financial-accuracy -p test_audit_preparation.py -v
```

The Phase 2 accounting remediation proposal remains unchanged. Remaining business/schema assumptions: exact live issuance/status mapping; amount basis vs persisted totals; stable employee attribution and active/inactive scope; canonical duplicate interpretation; adjustment identities/statuses/links/posting periods; issue-date/timezone rules and financial-vs-calendar-year definitions; full dataset/fallback provenance. None is silently approved by this audit file.
