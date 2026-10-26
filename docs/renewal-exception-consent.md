# Renewal exception comparison and consent

Prepared locally on 26 October 2026. No production data, migrations, commits, pushes or deployment were performed during preparation.

## Workflow

In **Mark as Won → Already renewed — Link existing records**, select the existing invoice/contract. Compare the previous and selected customer, premises, service, dates and amount. Links open either original record. The expected next start is displayed without changing existing dates.

Authorised renewal managers can approve these exceptions:

- A selected period that does not follow the previous period, including an overlap or earlier period.
- A premises mismatch, provided they confirm the same service location.
- Different service names, provided they confirm that the selected service fulfils this renewal.
- An issued record not classified as a contract, provided it has valid explicit dates and they confirm it represents the renewal contract.

Each applicable exception has a separate checkbox. A reason and valid actual agreement date are required, followed by the final confirmation dialog. Changing the selected record or refreshing clears the confirmations. Normal eligible links do not require exception consent.

Saving marks the renewal Won using the selected period and existing allocated service amount. It links the existing invoice; it does not create another invoice, edit either contract's dates, alter invoice amounts/statuses or change yearly sales calculations.

## Protections and audit

The server checks manager permission, every required consent, reason and preview versions again within the existing transaction. Customer identity, issued status, valid dates, valid amounts, multi-service allocation and duplicate-link protections remain enforced. Circular renewal chains are rejected, including indirect cycles.

Permissions, missing/invalid data, drafts/cancelled/void/proforma records, stale comparisons, lost renewals and duplicate/circular links cannot be bypassed with consent. Correct the original records or refresh as directed.

`existingRenewalLink.exceptionReview` records approved issue codes, reviewer, timestamp, reason, previous/selected snapshots and source/target/renewal version hashes. The existing `premisesReview` metadata remains compatible. An audit failure rolls back the renewal update; retrying the same approved link does not duplicate the audit.

No schema change is required: approval metadata uses the existing renewal JSON payload and audit history. Deploy frontend/backend together: reviewed requests now include a renewal comparison version as well as the existing invoice/source versions. Older clients must refresh before submitting a reviewed exception; ordinary existing-link requests retain their prior behaviour.

## Validation and limits

- 39 focused existing-link tests passed, including consent, manager permissions, concurrent/duplicate safeguards, stale snapshots, amount allocation, cycles, audit rollback and idempotence.
- 36 security tests passed.
- 46 isolated browser checks passed, including period and combined exceptions, missing/withdrawn consent, required reason, cancellation of final confirmation, refreshing, non-manager restrictions, normal links, stale rejection, mobile and light/dark layouts.
- Isolated frontend production build, Node syntax and whitespace checks passed.
- `renewals-hardening.test.js` still has two pre-existing source-pattern failures concerning legacy Renewed/Declined tab names and Won/Lost display labels (13 pass, 2 fail). The same two failures were reproduced against the pre-change frontend snapshot; those unrelated behaviours/tests were preserved.

Browser saves and database transactions used local in-memory fixtures only. No live renewal was marked Won, and production reconciliation/deployment sign-off is not claimed. Local evidence is under `/private/tmp/skuas-renewal-consent-review/`.
