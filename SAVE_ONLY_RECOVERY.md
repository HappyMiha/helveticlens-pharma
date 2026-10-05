# Recover private contributions after interrupted saves

Scope recorded 5 October 2026: existing save-only dossier notes, source references,
relevance feedback and attachments. The current entries/files endpoints already
support actor-bound request identities; no Core, source or model change is needed.

An uncertain write retains the same request identity for the same submitted
payload. Successful acknowledgement clears only the submitted draft, before the
separate dossier refresh. A newer draft is preserved. Refresh failure explicitly
says the contribution was saved and does not invite a duplicate write. Failed
attachments retain their selected file and offer an explicit same-request retry.

Acceptance: lost-response retries preserve keys; acknowledged writes plus failed
refresh cannot masquerade as failed saves; notes and references edited in flight
survive acknowledgement; failed files remain retryable; different payloads use
different identities; no automatic writes, AI analysis or notification delivery.

Validation: all 521 client tests passed, including seven mounted recovery cases.
Lint and type checking passed; independent read-only review approved the changes.
Production build and exact source activation are recorded in the release receipt.
No provider calls, new research, outgoing email or production fixtures were used.
