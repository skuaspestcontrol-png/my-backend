-- Destructive rollback of NEW feature tables only. Export populated reports first.
-- Requires explicit operator approval; never run against production automatically.
DROP TABLE IF EXISTS service_report_request_keys;
DROP TABLE IF EXISTS service_report_audit_logs;
DROP TABLE IF EXISTS service_report_files;
DROP TABLE IF EXISTS service_report_versions;
DROP TABLE IF EXISTS service_report_permissions;
DROP TABLE IF EXISTS service_reports;
