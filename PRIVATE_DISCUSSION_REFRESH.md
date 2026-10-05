# Slow private discussion refreshes

Scope recorded 5 October 2026. The private discussion reader polls claim-backed
notes every 15 seconds and when the window regains focus. Each poll previously
superseded the outstanding detail read, so a consistently slower connection could
prevent refreshed evidence and review status from ever reaching the reader.

Use the existing question reader and authenticated endpoint. Background interval
and focus reads wait for the current request. Explicit navigation, reply paging,
mutation refresh and retry still supersede it. Cancelling or leaving the view
invalidates late success and failure. A superseded request cannot release a newer
request's pending marker. No Core, source, model, or API contract changes.

Acceptance: the mounted discussion updates after a slow read spanning several
polls/focus events; manual page changes retain priority; failures hide unconfirmed
notes and retry the same page; returning to the library and unmounting prevent
late results from reopening a question. Preserve existing appearance, drafts,
revision handling and sign-out's parent unmount behavior.

Validation: 514 client tests passed, including six new ownership and mounted
refresh regressions. Lint and type checking passed; independent read-only review
approved the change. The production build and exact source activation are recorded
in the release receipt. No production research or provider inference was run.
