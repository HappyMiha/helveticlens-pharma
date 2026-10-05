# Recover the work the reader was doing

Two confirmed client failures lost the user's place. A failed background research
history read unmounted the episode editor, discarding a typed refinement or the
request key for a reply whose outcome was uncertain. A failed next-page search
discarded its offset and saved snapshot; the only available retry began again at
the first page.

Keep the exploration editor's last accepted identity while its history is
temporarily unavailable. Existing error guards must still hide evidence and
actions until the list is checked again. A different accepted head remounts its
own editor; session changes clear input and pending replies.

A failed search page may be retried explicitly with its original query, mode,
offset, capture timestamp and corpus fingerprint after a transient error. Never
retry automatically. Access, evidence-change and malformed-result failures
require a fresh search. Changes to input, mode, session or finding decisions
discard the obsolete retry action. Failed results remain hidden.

Both changes use current APIs and preserve existing authorization, idempotency and
evidence checks. No provider call, production fixture, research replay, new budget
or Core deployment is needed to validate this client recovery behavior.

## Validation

Both clients passed 508 tests, lint and typecheck. Eleven new mounted recovery
cases cover draft and uncertain-reply preservation, session reset, accepted head
replacement, exact failed-page retry in all three search modes, stale/access
failures and obsolete retry removal. The existing exploration and evidence-search
suites also pass. Independent review found no blocker. Production build and exact
Git/Sites publication are recorded in the external release receipt.
