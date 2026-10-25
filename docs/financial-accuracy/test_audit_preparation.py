"""Offline SQL structure/safety regression checks. Never connects to or executes a database.

Requires SQLGlot (a parser only); see phase-1b-execution-plan.md for isolated setup.
"""
from pathlib import Path
import re
import unittest

import sqlglot
from sqlglot import exp

SQL_PATH = Path(__file__).with_name('production-reconciliation-selects.sql')
SQL = SQL_PATH.read_text()
TREES = sqlglot.parse(SQL, read='mysql', error_level=sqlglot.ErrorLevel.RAISE)
IDS = re.findall(r'^-- S(\d{2}):', SQL, re.M)
STATEMENTS = dict(zip(IDS, TREES))


class AuditPreparationTests(unittest.TestCase):
    def test_exactly_21_identified_select_statements_in_three_batches(self):
        self.assertEqual(len(TREES), 21)
        self.assertEqual(len(IDS), 21)
        self.assertEqual(set(IDS), {f'{i:02}' for i in range(1, 22)})
        self.assertEqual(re.findall(r'BATCH ([ABC]):', SQL), ['A', 'B', 'C'])
        self.assertTrue(all(isinstance(tree, exp.Select) for tree in TREES))

    def test_no_nested_mutation_export_locking_session_or_command(self):
        forbidden = {'Insert', 'Update', 'Delete', 'Create', 'Drop', 'Alter', 'Merge',
                     'Command', 'Transaction', 'Commit', 'Rollback', 'Set', 'Grant',
                     'Revoke', 'Into', 'Lock', 'Execute'}
        for tree in TREES:
            self.assertFalse({type(node).__name__ for node in tree.walk()} & forbidden)
        clean = re.sub(r'--[^\n]*', '', SQL)
        clean = re.sub(r"'(?:''|[^'])*'", "''", clean)
        self.assertIsNone(re.search(r'\b(CALL|PROCEDURE|OUTFILE|DUMPFILE|GET_LOCK|LOAD_FILE|SLEEP|BENCHMARK)\b|:=', clean, re.I))

    def test_only_expected_base_tables_and_system_metadata(self):
        for tree in TREES:
            for table in tree.find_all(exp.Table):
                if table.db:
                    self.assertEqual(table.db.lower(), 'information_schema')
                    self.assertIn(table.name.upper(), {'COLUMNS', 'TABLES', 'STATISTICS', 'KEY_COLUMN_USAGE'})
                else:
                    self.assertIn(table.name, {'invoices', 'employees', 'sales_targets'})
        for key in ['01', '02', '03', '04']:
            self.assertTrue(all(table.db.lower() == 'information_schema' for table in STATEMENTS[key].find_all(exp.Table)))

    def test_no_unknown_or_schema_qualified_routine_calls(self):
        allowed_anonymous = {'JSON_VALID', 'JSON_UNQUOTE', 'JSON_CONTAINS_PATH'}
        allowed_functions = {'AND','OR','CASE','IF','CAST','COALESCE','CONCAT_WS','CONVERT_TIMEZONE',
                             'COUNT','CURRENT_SCHEMA','CURRENT_VERSION','GREATEST','JSON_EXTRACT',
                             'JSON_TYPE','LEFT','LOWER','MONTH','NULLIF','REGEXP_LIKE','REGEXP_REPLACE',
                             'SUM','TRIM','TS_OR_DS_TO_DATE','UPPER','YEAR'}
        for tree in TREES:
            for func in tree.find_all(exp.Func):
                if isinstance(func, exp.Anonymous):
                    self.assertIn(func.name.upper(), allowed_anonymous)
                    self.assertNotIsInstance(func.parent, exp.Dot)
                else:
                    self.assertIn(func.sql_name(), allowed_functions)

    def test_status_classifier_is_identical_across_all_periods_and_exceptions(self):
        classifiers = []
        for key in ['07', '08', '09', '10']:
            classified = next(node for node in STATEMENTS[key].find_all(exp.Subquery) if node.alias == 'classified')
            classifiers.append(classified.this.sql(dialect='mysql'))
        self.assertEqual(len(set(classifiers)), 1)
        text = classifiers[0]
        self.assertLess(text.index("'STATUS_CONFLICT'"), text.index("'SENT'"))
        for label in ['INVALID_PAYLOAD','INVALID_STATUS_TYPE','UNKNOWN_OR_MISSING']:
            self.assertIn(label, text)
        self.assertIn('COALESCE(column_status, payload_status)', text)

    def test_missing_dates_are_unallocated_not_filtered_out_or_assigned_to_month(self):
        tree = STATEMENTS['07']
        where = tree.args['where'].sql()
        self.assertIn('OR invoice_date IS NULL', where)
        period = next(x for x in tree.expressions if x.alias == 'period_bucket')
        self.assertIn('UNALLOCATED_MISSING_ISSUE_DATE_ALL_PERIODS', period.sql())
        self.assertIn('SELECTED_MONTH', period.sql())
        self.assertNotIn('missing_issue_dates', [x.alias for x in tree.expressions])

    def test_eligible_sales_and_adjustments_are_null_not_inferred_from_status(self):
        for key, alias in [('07','eligible_sales_inr'),('09','eligible_sales_inr'),
                           ('10','eligible_year_sales_inr'),('17','verified_sales_adjustments_inr')]:
            expr = next(x for x in STATEMENTS[key].expressions if x.alias == alias)
            self.assertIsInstance(expr.this, exp.Cast)
            self.assertIsInstance(expr.this.this, exp.Null)
            status = next(x for x in STATEMENTS[key].expressions if x.alias == 'verification_status')
            self.assertIn('UNVERIFIED', status.sql())

    def test_financial_totals_are_not_coalesced_to_zero(self):
        for tree in TREES:
            for expr in tree.expressions:
                if expr.alias.endswith('_inr'):
                    self.assertFalse(any(isinstance(node, exp.Coalesce) for node in expr.this.walk()))
        self.assertIn('TARGET_NOT_CONFIGURED', STATEMENTS['05'].sql())
        self.assertFalse(STATEMENTS['05'].args.get('group'))
        self.assertIn('NO_COMPARABLE_ROWS', STATEMENTS['21'].sql())

    def test_no_personal_data_or_raw_json_in_financial_outputs(self):
        for key, tree in STATEMENTS.items():
            for expr in tree.expressions:
                self.assertNotIsInstance(expr, exp.Star)
                if int(key) >= 5 and isinstance(expr, exp.Column):
                    self.assertEqual(expr.name, 'status_bucket')
                if int(key) >= 5:
                    for node in expr.walk():
                        if isinstance(node, exp.Func) and (node.sql_name().startswith('JSON') or isinstance(node, exp.Anonymous) and node.name.upper().startswith('JSON')):
                            self.assertIsNotNone(node.find_ancestor(exp.Count, exp.Sum))
        # Name/identity values may be used inside grouping, but never projected as report rows.
        self.assertNotIn('customer_name', SQL)
        self.assertNotIn('portal_password', SQL)

    def test_json_extract_inputs_are_guarded_or_from_guarded_normalizer(self):
        for tree in TREES:
            for func in tree.find_all(exp.JSONExtract):
                source = func.this
                self.assertTrue(isinstance(source, exp.Case) or isinstance(source, exp.Column) and source.name == 'safe_payload')

    def test_period_boundaries_and_global_limit_are_explicit(self):
        for key in ['07','09','10']:
            self.assertIn('2026-01-01', STATEMENTS[key].sql())
            self.assertIn('2027-01-01', STATEMENTS[key].sql())
        cap = next(STATEMENTS['19'].find_all(exp.Limit))
        self.assertEqual(cap.expression.name, '4000')
        recent = next(x for x in STATEMENTS['19'].find_all(exp.Subquery) if x.alias == 'recent')
        self.assertIsNone(recent.this.args.get('where'))


if __name__ == '__main__':
    unittest.main()
