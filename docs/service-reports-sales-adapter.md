# Service Reports Sales adapter ingress — Stage A

The existing Sales API is the only mobile adapter; CRM remains the owner of report schema, storage, approval, evidence, audit history and PDF generation. No report tables, renderer or permission grants are duplicated.

The CRM adds `createSalesReportAuth` only at `/api/service-reports`, between ordinary portal identity attachment and the existing authentication guard. Without an adapter header, normal CRM authentication is unchanged. A presented adapter header must validate and cannot fall back to a supplied portal session or bearer token.

Configure `SERVICE_REPORT_BRIDGE_SECRET` on both services using a fresh feature-only random key (at least 32 bytes), distinct from portal/Sales JWT secrets. Do not configure any administrator forwarding credentials. CRM must represent the same employee-row domain used by the Sales API's existing authentication database. Missing/mismatched configuration fails closed. No actual environment files or production settings were changed during Stage A.

Delegation is HMAC/domain-separated, lasts 15 seconds, binds the exact method/target and contains no asserted employee role or permissions. CRM independently loads the exact employee row, verifies Sales eligibility/active identity and uses the Phase 2 canonical resolver. The projected role is `Sales`, even if the employee has another administrator role; explicit feature grants and record scope still apply. The bounded process-local nonce cache is additional replay defence; database idempotency/revision/version guarantees remain authoritative across processes.

Only report discovery, drafts, submission, history, private evidence and PDFs are allowed. Permission administration, approval and revision-management endpoints remain CRM-only. The optional `share=1` PDF intent additionally requires `share` on the CRM backend, both before settings loading and inside final PDF authorization. Existing downloads without this optional intent retain their original behavior. Once a user has PDF bytes, share intent is not operating-system DRM.

Both repositories have an identical small v1 protocol utility; the isolated integration test checks that they agree. This copies no report business logic. The canonical PDF renderer, schema, migrations and private storage implementation are untouched.

See the Sales API's `docs/service-reports-stage-a.md` for endpoint, payload, transport, safe-retry and Stage B contracts. Stage A tests import the real middleware/router factories with synthetic credentials and a guarded disposable MySQL socket, never the full production entrypoints. No production database access, schema migration, commit or deployment occurred. Sales App screens and complete device/offline verification remain later stages requiring approval.
