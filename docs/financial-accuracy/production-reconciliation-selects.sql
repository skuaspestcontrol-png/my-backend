-- PHASE 1B: LOCAL PREPARATION ONLY. DO NOT EXECUTE BEFORE APPROVAL.
-- 21 SELECT-only statements. Stable IDs S01..S21 retain the previous statement mapping.
-- Batch A: metadata only. B/C: require ONE immutable, approved audit snapshot.
-- No engine/version assumption: see phase-1b-execution-plan.md for capability gates.
-- Conservative syntax floors: MariaDB 10.2.7 / MySQL 8.0.11; neither was runtime-tested.
-- Examples use October/calendar year 2026: review all target/month/year/date literals together.
-- No stored routines/views, explicit locking reads, session changes, exports, DDL or DML.
-- No customer/employee identity values are returned. Aggregate money remains confidential.
-- Raw ledger totals are NOT certified GST-inclusive API sales. NULL financial values with
-- UNVERIFIED status MUST NOT be formatted as zero. No status is treated as approved eligible.
-- Owner policy: eligible ISSUED invoice sales, regardless of collections; exclude drafts/voids/
-- cancellations; one canonical ID; verified credits, issue dates and stable employee IDs.
-- Status diagnostics only: column first, payload string fallback; any conflict/type/payload
-- error is an exception. The status vocabulary below is NOT an eligibility allowlist.

-- ==================== BATCH A: METADATA ====================
-- Execution gate: approved metadata access; no application connection hooks.

-- S01: Environment/version/timezone labels.
-- Expected cost: LOW. Metadata only; recheck if schema changes.
SELECT VERSION() AS database_version, @@session.time_zone AS sql_session_timezone,
       @@global.time_zone AS sql_global_timezone, @@system_time_zone AS database_system_timezone,
       CONVERT_TZ('2026-12-31 18:30:00', '+00:00', '+05:30') AS india_year_boundary;

-- S02: Base-table columns, types, collation and engine.
-- Expected cost: LOW. Metadata only; recheck if schema changes.
SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLLATION_NAME, t.ENGINE, t.TABLE_TYPE
FROM information_schema.COLUMNS c
JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
WHERE c.TABLE_SCHEMA = DATABASE() AND t.TABLE_TYPE = 'BASE TABLE'
  AND ((c.TABLE_NAME IN ('invoices', 'employees', 'sales_targets')
        AND c.COLUMN_NAME IN ('id','external_id','invoice_number','invoice_type','invoice_status',
          'invoice_date','total_amount','payload','created_at','emp_code','first_name','last_name',
          'role','role_name','department','status','sales_person_id','employee_id','employee_name',
          'employee_code','sales_person_name','sales_person_code','target_type','target_month',
          'target_year','revenue_target','is_active'))
       OR LOWER(c.TABLE_NAME) REGEXP 'credit|revers|refund'
       OR LOWER(c.COLUMN_NAME) REGEXP 'credit_note|reversal|refund|original_invoice|reversed_invoice')
ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;

-- S03: Identity/index metadata.
-- Expected cost: LOW. Metadata only; recheck if schema changes.
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('invoices','employees','sales_targets')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- S04: Relationship metadata; absence does not prove no application links.
-- Expected cost: LOW. Metadata only; recheck if schema changes.
SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
  AND (TABLE_NAME IN ('invoices','sales_targets') OR LOWER(TABLE_NAME) REGEXP 'credit|revers|refund'
       OR REFERENCED_TABLE_NAME = 'invoices');

-- ==================== BATCH B: FINANCIAL BASELINE ====================
-- Execution gate: approved stable snapshot, verified schema/functions and SELECT-only principal.

-- S05: Selected-month target configuration; no configured rows => NULL money.
-- Expected cost: LOW/MODERATE. Stable snapshot required.
SELECT 2026 AS target_year, 10 AS target_month, COUNT(*) AS configured_monthly_rows,
       SUM(revenue_target) AS raw_configured_target_inr,
       COUNT(CASE WHEN revenue_target = 0 THEN 1 END) AS explicit_zero_rows,
       COUNT(CASE WHEN revenue_target < 0 OR revenue_target IS NULL THEN 1 END) AS invalid_amount_rows,
       CASE WHEN COUNT(*) = 0 THEN 'TARGET_NOT_CONFIGURED'
            WHEN COUNT(CASE WHEN revenue_target < 0 OR revenue_target IS NULL THEN 1 END) > 0
              THEN 'UNVERIFIED_TARGET_AMOUNTS'
            ELSE 'UNVERIFIED_EMPLOYEE_SCOPE' END AS verification_status
FROM sales_targets
WHERE is_active = 1 AND target_type = 'monthly' AND target_year = 2026 AND target_month = 10;

-- S06: Year target configurations; annual override/scope not reproduced.
-- Expected cost: LOW/MODERATE. Stable snapshot required.
SELECT CASE WHEN CAST(LOWER(target_type) AS BINARY) = 'monthly' THEN 'monthly'
            WHEN CAST(LOWER(target_type) AS BINARY) = 'yearly' THEN 'yearly'
            ELSE 'UNMAPPED_TYPE' END AS target_type_bucket,
       COUNT(*) AS active_year_rows, SUM(revenue_target) AS raw_target_inr,
       COUNT(CASE WHEN revenue_target < 0 OR revenue_target IS NULL THEN 1 END) AS invalid_amount_rows,
       'UNVERIFIED_SCOPE_AND_ANNUAL_OVERRIDE_RULE' AS verification_status
FROM sales_targets WHERE is_active = 1 AND target_year = 2026
GROUP BY target_type_bucket;

-- S07: Status/period inventory INCLUDING unallocated NULL dates; no eligible-sales claim.
-- Expected cost: HIGH: full invoice scan to include ALL NULL dates; JSON. Stable snapshot required.
SELECT CASE WHEN invoice_date IS NULL THEN 'UNALLOCATED_MISSING_ISSUE_DATE_ALL_PERIODS'
            WHEN invoice_date >= '2026-10-01' AND invoice_date < '2026-11-01' THEN 'SELECTED_MONTH'
            ELSE 'OTHER_MONTH_IN_SELECTED_YEAR' END AS period_bucket,
       status_bucket, COUNT(*) AS invoice_rows, SUM(total_amount) AS provisional_persisted_ledger_inr,
       COUNT(CASE WHEN invoice_date IS NULL THEN 1 END) AS unallocated_issue_date_rows,
       COUNT(CASE WHEN total_amount IS NULL THEN 1 END) AS missing_amount_rows,
       CAST(NULL AS DECIMAL(18,2)) AS eligible_sales_inr,
       'UNVERIFIED_STATUS_MAPPING_AND_AMOUNT_BASIS' AS verification_status
FROM (
  SELECT id, invoice_date, total_amount,
         CASE WHEN payload_valid = 0 THEN 'INVALID_PAYLOAD'
              WHEN payload_status_type IS NOT NULL AND payload_status_type NOT IN ('STRING','NULL')
                THEN 'INVALID_STATUS_TYPE'
              WHEN column_status IS NOT NULL AND payload_status IS NOT NULL AND CAST(column_status AS BINARY) <> CAST(payload_status AS BINARY)
                THEN 'STATUS_CONFLICT'
              WHEN CAST(COALESCE(column_status,payload_status) AS BINARY) IN
                ('SENT','PAID','DRAFT','OVERDUE','CANCELLED','CANCELED','VOID','VOIDED',
                 'ISSUED','FINALISED','FINALIZED','UNPAID','PARTIAL','PARTIALLY_PAID')
                THEN COALESCE(column_status,payload_status)
              ELSE 'UNKNOWN_OR_MISSING' END AS status_bucket
  FROM (
    SELECT id, invoice_date, total_amount, payload_valid,
           NULLIF(UPPER(TRIM(invoice_status)),'') AS column_status,
           JSON_TYPE(JSON_EXTRACT(safe_payload,'$.status')) AS payload_status_type,
           CASE WHEN JSON_TYPE(JSON_EXTRACT(safe_payload,'$.status')) = 'STRING'
                THEN NULLIF(UPPER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(safe_payload,'$.status')))),'')
                ELSE NULL END AS payload_status
    FROM (
      SELECT id, invoice_date, total_amount, invoice_status,
             CASE WHEN JSON_VALID(payload) = 1
                       AND JSON_TYPE(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END) = 'OBJECT'
                  THEN 1 ELSE 0 END AS payload_valid,
             CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END AS safe_payload
      FROM invoices
    ) safe_invoices
  ) normalized_statuses
) classified
WHERE (invoice_date >= '2026-01-01' AND invoice_date < '2027-01-01') OR invoice_date IS NULL
GROUP BY period_bucket, status_bucket;

-- S09: Monthly provisional ledger totals; identical status classifier to S07/S10.
-- Expected cost: MODERATE/HIGH: year range plus JSON. Stable snapshot required.
SELECT YEAR(invoice_date) AS issue_year, MONTH(invoice_date) AS issue_month,
       COUNT(*) AS canonical_rows, COUNT(DISTINCT id) AS unique_canonical_rows,
       SUM(total_amount) AS provisional_persisted_ledger_inr,
       COUNT(CASE WHEN total_amount IS NULL THEN 1 END) AS missing_amount_rows,
       COUNT(CASE WHEN status_bucket IN ('INVALID_PAYLOAD','INVALID_STATUS_TYPE','STATUS_CONFLICT','UNKNOWN_OR_MISSING') THEN 1 END) AS status_exception_rows,
       CAST(NULL AS DECIMAL(18,2)) AS eligible_sales_inr,
       'UNVERIFIED_STATUS_MAPPING_AND_AMOUNT_BASIS' AS verification_status
FROM (
  SELECT id, invoice_date, total_amount,
         CASE WHEN payload_valid = 0 THEN 'INVALID_PAYLOAD'
              WHEN payload_status_type IS NOT NULL AND payload_status_type NOT IN ('STRING','NULL')
                THEN 'INVALID_STATUS_TYPE'
              WHEN column_status IS NOT NULL AND payload_status IS NOT NULL AND CAST(column_status AS BINARY) <> CAST(payload_status AS BINARY)
                THEN 'STATUS_CONFLICT'
              WHEN CAST(COALESCE(column_status,payload_status) AS BINARY) IN
                ('SENT','PAID','DRAFT','OVERDUE','CANCELLED','CANCELED','VOID','VOIDED',
                 'ISSUED','FINALISED','FINALIZED','UNPAID','PARTIAL','PARTIALLY_PAID')
                THEN COALESCE(column_status,payload_status)
              ELSE 'UNKNOWN_OR_MISSING' END AS status_bucket
  FROM (
    SELECT id, invoice_date, total_amount, payload_valid,
           NULLIF(UPPER(TRIM(invoice_status)),'') AS column_status,
           JSON_TYPE(JSON_EXTRACT(safe_payload,'$.status')) AS payload_status_type,
           CASE WHEN JSON_TYPE(JSON_EXTRACT(safe_payload,'$.status')) = 'STRING'
                THEN NULLIF(UPPER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(safe_payload,'$.status')))),'')
                ELSE NULL END AS payload_status
    FROM (
      SELECT id, invoice_date, total_amount, invoice_status,
             CASE WHEN JSON_VALID(payload) = 1
                       AND JSON_TYPE(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END) = 'OBJECT'
                  THEN 1 ELSE 0 END AS payload_valid,
             CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END AS safe_payload
      FROM invoices
    ) safe_invoices
  ) normalized_statuses
) classified
WHERE invoice_date >= '2026-01-01' AND invoice_date < '2027-01-01'
GROUP BY YEAR(invoice_date),MONTH(invoice_date) ORDER BY issue_month;

-- S10: Year provisional ledger total; identical classifier to S07/S09.
-- Expected cost: MODERATE/HIGH: year range plus JSON. Stable snapshot required.
SELECT 2026 AS issue_year, COUNT(*) AS canonical_year_rows,
       SUM(total_amount) AS provisional_persisted_year_ledger_inr,
       COUNT(CASE WHEN total_amount IS NULL THEN 1 END) AS missing_amount_rows,
       COUNT(CASE WHEN status_bucket IN ('INVALID_PAYLOAD','INVALID_STATUS_TYPE','STATUS_CONFLICT','UNKNOWN_OR_MISSING') THEN 1 END) AS status_exception_rows,
       CAST(NULL AS DECIMAL(18,2)) AS eligible_year_sales_inr,
       'UNVERIFIED_STATUS_MAPPING_AND_AMOUNT_BASIS' AS verification_status
FROM (
  SELECT id, invoice_date, total_amount,
         CASE WHEN payload_valid = 0 THEN 'INVALID_PAYLOAD'
              WHEN payload_status_type IS NOT NULL AND payload_status_type NOT IN ('STRING','NULL')
                THEN 'INVALID_STATUS_TYPE'
              WHEN column_status IS NOT NULL AND payload_status IS NOT NULL AND CAST(column_status AS BINARY) <> CAST(payload_status AS BINARY)
                THEN 'STATUS_CONFLICT'
              WHEN CAST(COALESCE(column_status,payload_status) AS BINARY) IN
                ('SENT','PAID','DRAFT','OVERDUE','CANCELLED','CANCELED','VOID','VOIDED',
                 'ISSUED','FINALISED','FINALIZED','UNPAID','PARTIAL','PARTIALLY_PAID')
                THEN COALESCE(column_status,payload_status)
              ELSE 'UNKNOWN_OR_MISSING' END AS status_bucket
  FROM (
    SELECT id, invoice_date, total_amount, payload_valid,
           NULLIF(UPPER(TRIM(invoice_status)),'') AS column_status,
           JSON_TYPE(JSON_EXTRACT(safe_payload,'$.status')) AS payload_status_type,
           CASE WHEN JSON_TYPE(JSON_EXTRACT(safe_payload,'$.status')) = 'STRING'
                THEN NULLIF(UPPER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(safe_payload,'$.status')))),'')
                ELSE NULL END AS payload_status
    FROM (
      SELECT id, invoice_date, total_amount, invoice_status,
             CASE WHEN JSON_VALID(payload) = 1
                       AND JSON_TYPE(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END) = 'OBJECT'
                  THEN 1 ELSE 0 END AS payload_valid,
             CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END AS safe_payload
      FROM invoices
    ) safe_invoices
  ) normalized_statuses
) classified
WHERE invoice_date >= '2026-01-01' AND invoice_date < '2027-01-01';

-- ==================== BATCH C: DATA-QUALITY INVESTIGATION ====================
-- Execution gate: approved stable snapshot, verified schema/functions and SELECT-only principal.

-- S08: Global exceptions and missing dates; mutually exclusive status exception buckets.
-- Expected cost: HIGH: full invoice/JSON scan. Stable snapshot required.
SELECT COUNT(*) AS total_invoice_rows,
       COUNT(CASE WHEN status_bucket = 'STATUS_CONFLICT' THEN 1 END) AS status_conflict_rows,
       COUNT(CASE WHEN status_bucket = 'UNKNOWN_OR_MISSING' THEN 1 END) AS unknown_or_missing_status_rows,
       COUNT(CASE WHEN status_bucket = 'INVALID_PAYLOAD' THEN 1 END) AS invalid_payload_rows,
       COUNT(CASE WHEN status_bucket = 'INVALID_STATUS_TYPE' THEN 1 END) AS invalid_status_type_rows,
       COUNT(CASE WHEN invoice_date IS NULL THEN 1 END) AS unallocated_issue_date_rows_all_periods,
       COUNT(CASE WHEN total_amount IS NULL OR total_amount < 0 THEN 1 END) AS missing_or_negative_amount_rows,
       'UNVERIFIED_EXCEPTION_REVIEW_REQUIRED' AS verification_status
FROM (
  SELECT id, invoice_date, total_amount,
         CASE WHEN payload_valid = 0 THEN 'INVALID_PAYLOAD'
              WHEN payload_status_type IS NOT NULL AND payload_status_type NOT IN ('STRING','NULL')
                THEN 'INVALID_STATUS_TYPE'
              WHEN column_status IS NOT NULL AND payload_status IS NOT NULL AND CAST(column_status AS BINARY) <> CAST(payload_status AS BINARY)
                THEN 'STATUS_CONFLICT'
              WHEN CAST(COALESCE(column_status,payload_status) AS BINARY) IN
                ('SENT','PAID','DRAFT','OVERDUE','CANCELLED','CANCELED','VOID','VOIDED',
                 'ISSUED','FINALISED','FINALIZED','UNPAID','PARTIAL','PARTIALLY_PAID')
                THEN COALESCE(column_status,payload_status)
              ELSE 'UNKNOWN_OR_MISSING' END AS status_bucket
  FROM (
    SELECT id, invoice_date, total_amount, payload_valid,
           NULLIF(UPPER(TRIM(invoice_status)),'') AS column_status,
           JSON_TYPE(JSON_EXTRACT(safe_payload,'$.status')) AS payload_status_type,
           CASE WHEN JSON_TYPE(JSON_EXTRACT(safe_payload,'$.status')) = 'STRING'
                THEN NULLIF(UPPER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(safe_payload,'$.status')))),'')
                ELSE NULL END AS payload_status
    FROM (
      SELECT id, invoice_date, total_amount, invoice_status,
             CASE WHEN JSON_VALID(payload) = 1
                       AND JSON_TYPE(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END) = 'OBJECT'
                  THEN 1 ELSE 0 END AS payload_valid,
             CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END AS safe_payload
      FROM invoices
    ) safe_invoices
  ) normalized_statuses
) classified;

-- S11: Repeated business numbers: candidates, not automatic duplicate identities.
-- Expected cost: HIGH: full scan/expression grouping/sort. Stable snapshot required.
SELECT COUNT(*) AS repeated_number_groups, COALESCE(SUM(rows_per_number),0) AS involved_rows,
       COALESCE(SUM(rows_per_number-1),0) AS additional_rows_requiring_review
FROM (SELECT COUNT(*) AS rows_per_number FROM invoices
      WHERE NULLIF(TRIM(invoice_number),'') IS NOT NULL
      GROUP BY LOWER(TRIM(invoice_number)) HAVING COUNT(*) > 1) d;

-- S12: Repeated external identities; may be deferred if unique index verified.
-- Expected cost: MODERATE: index scan. Stable snapshot required.
SELECT COUNT(*) AS repeated_external_identity_groups
FROM (SELECT COUNT(*) AS n FROM invoices GROUP BY external_id HAVING COUNT(*) > 1) d;

-- S13: Duplicate active target periods.
-- Expected cost: MODERATE: grouping. Stable snapshot required.
SELECT COUNT(*) AS duplicate_target_groups, COALESCE(SUM(n-1),0) AS additional_target_rows
FROM (SELECT COUNT(*) AS n FROM sales_targets WHERE is_active = 1
      GROUP BY sales_person_id,target_type,target_year,target_month HAVING COUNT(*) > 1) d;

-- S14: Target stable-ID coverage; optional legacy aliases need separate review.
-- Expected cost: HIGH: correlated scans, casts and OR. Stable snapshot required.
SELECT COUNT(*) AS monthly_target_rows,
       COALESCE(SUM(matches_found=0),0) AS unmatched_stable_ids,
       COALESCE(SUM(matches_found>1),0) AS ambiguous_stable_ids
FROM (SELECT (SELECT COUNT(*) FROM employees e
              WHERE CAST(e.id AS CHAR)=CAST(t.sales_person_id AS CHAR)
                 OR e.external_id=CAST(t.sales_person_id AS CHAR)) AS matches_found
      FROM sales_targets t WHERE t.is_active=1 AND t.target_type='monthly'
        AND t.target_year=2026 AND t.target_month=10) m;

-- S15: Employee name collisions: output counts only, never map invoices by names.
-- Expected cost: MODERATE/HIGH: JSON/regex/grouping. Stable snapshot required.
SELECT COUNT(*) AS employee_name_collision_groups, COALESCE(SUM(n),0) AS involved_employee_rows
FROM (SELECT COUNT(*) AS n FROM employees
      WHERE COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.fullName')),''),
                     NULLIF(TRIM(CONCAT_WS(' ',first_name,last_name)),''),
                     NULLIF(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.name')),'')) IS NOT NULL
      GROUP BY TRIM(REGEXP_REPLACE(LOWER(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.fullName')),''),
                     NULLIF(TRIM(CONCAT_WS(' ',first_name,last_name)),''),
                     JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.name')))), '[^a-z0-9]+',' '))
      HAVING COUNT(*)>1) d;

-- S16: Invoice ID-key presence; presence is NOT a valid stable-ID mapping certificate.
-- Expected cost: HIGH: full invoice/JSON scan. Stable snapshot required.
SELECT COUNT(*) AS invoice_rows,
       COUNT(CASE WHEN JSON_VALID(payload) = 1 THEN NULL ELSE 1 END) AS invalid_or_null_payload_rows,
       COALESCE(SUM(JSON_CONTAINS_PATH(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'one','$.sales_person_id','$.salesPersonId',
         '$.salespersonId','$.salesperson_id','$.employee_id','$.employeeId')),0) AS rows_with_id_alias_key,
       COALESCE(SUM(JSON_CONTAINS_PATH(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'one','$.salesperson')),0) AS rows_with_legacy_salesperson_key
FROM invoices;

-- S17: Credit/refund/reversal key discovery; actual adjustments stay UNVERIFIED.
-- Expected cost: HIGH: full invoice/JSON scan. Stable snapshot required.
SELECT COUNT(*) AS invoice_rows,
       COUNT(CASE WHEN JSON_VALID(payload) = 1 THEN NULL ELSE 1 END) AS invalid_or_null_payload_rows,
       COUNT(CASE WHEN JSON_CONTAINS_PATH(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,
         'one','$.creditNoteId','$.credit_note_id','$.reversalOfInvoiceId','$.originalInvoiceId',
         '$.refundId','$.creditNotes','$.reversals') = 1 THEN 1 END) AS candidate_adjustment_key_rows,
       CAST(NULL AS DECIMAL(18,2)) AS verified_sales_adjustments_inr,
       'UNVERIFIED_ADJUSTMENT_MODEL' AS verification_status
FROM invoices;

-- S18: Full invoice count vs global cap; COUNT is not constant-time on InnoDB.
-- Expected cost: MODERATE: index scan. Stable snapshot required.
SELECT COUNT(*) AS all_invoice_rows, GREATEST(COUNT(*)-4000,0) AS rows_outside_global_cap
FROM invoices;

-- S19: Per-month omissions from the GLOBAL newest-4000 window.
-- Expected cost: MODERATE/HIGH: year range and 4000-ID derived join. Stable snapshot required.
SELECT YEAR(i.invoice_date) AS issue_year, MONTH(i.invoice_date) AS issue_month,
       COUNT(*) AS full_canonical_rows, SUM(recent.id IS NOT NULL) AS rows_in_api_window,
       SUM(recent.id IS NULL) AS rows_omitted_by_cap,
       CASE WHEN COUNT(CASE WHEN recent.id IS NULL AND i.total_amount IS NULL THEN 1 END) > 0
            THEN CAST(NULL AS DECIMAL(18,2))
            ELSE SUM(CASE WHEN recent.id IS NULL THEN i.total_amount ELSE 0 END) END AS provisional_omitted_ledger_inr,
       COUNT(CASE WHEN recent.id IS NULL AND i.total_amount IS NULL THEN 1 END) AS omitted_missing_amount_rows,
       'UNVERIFIED_AMOUNT_BASIS' AS verification_status
FROM invoices i LEFT JOIN (SELECT id FROM invoices ORDER BY id DESC LIMIT 4000) recent ON recent.id=i.id
WHERE i.invoice_date >= '2026-01-01' AND i.invoice_date < '2027-01-01'
GROUP BY YEAR(i.invoice_date),MONTH(i.invoice_date) ORDER BY issue_month;

-- S20: Issue-date/timezone provenance; do not shift DATE business dates.
-- Expected cost: HIGH: full invoice/JSON/regex scan. Stable snapshot required.
SELECT COUNT(*) AS invoice_rows,
       COUNT(CASE WHEN JSON_VALID(payload) = 1 THEN NULL ELSE 1 END) AS invalid_or_null_payload_rows,
       COALESCE(SUM(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.date')) REGEXP '(Z|[+-][0-9]{2}:[0-9]{2})$'),0)
         AS payload_issue_dates_with_explicit_timezone,
       COALESCE(SUM(invoice_date IS NOT NULL
          AND JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.date')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND CAST(invoice_date AS CHAR) <> LEFT(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.date')),10)),0)
         AS table_payload_issue_day_disagreements
FROM invoices;

-- S21: Common editor amount-basis variance, not exact API gross; decimal cast may round.
-- Expected cost: HIGH: year-range JSON/regex/decimal work. Stable snapshot required.
SELECT COUNT(*) AS rows_with_numeric_subtotal_and_tax,
       COALESCE(SUM(total_amount <> subtotal_value + tax_value),0) AS persisted_gross_difference_rows,
       SUM(total_amount - (subtotal_value + tax_value)) AS provisional_persisted_minus_subtotal_tax_inr,
       CASE WHEN COUNT(*) = 0 THEN 'NO_COMPARABLE_ROWS' ELSE 'UNVERIFIED_DIAGNOSTIC_ONLY' END AS verification_status
FROM (SELECT total_amount,
       CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.subtotal')) REGEXP '^[+-]?[0-9]+([.][0-9]+)?$'
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.subtotal')) AS DECIMAL(18,2)) ELSE NULL END AS subtotal_value,
       CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.totalTax')) REGEXP '^[+-]?[0-9]+([.][0-9]+)?$'
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(payload) = 1 THEN payload ELSE '{}' END,'$.totalTax')) AS DECIMAL(18,2)) ELSE NULL END AS tax_value
      FROM invoices WHERE invoice_date >= '2026-01-01' AND invoice_date < '2027-01-01') amounts
WHERE subtotal_value > 0 AND tax_value > 0 AND total_amount IS NOT NULL;
