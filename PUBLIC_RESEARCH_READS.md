# Let slow public research reads finish

Scope recorded 5 October 2026: fix confirmed read starvation in PublicResearchView
and its finding-review, identity-review and evidence-change readers. Their existing
15-second background refresh increments a token that unmounts the active request
lifecycle, so a response slower than the interval can never be accepted. Frequent
research events can trigger the same cancellation.

Dependencies/readiness: reuse the existing ResourceReader.poll operation, which
waits for an active read. Keep explicit refresh, mutation completion, selection,
account changes and revoked-access handling authoritative. No API, public consent,
model, polling frequency, source access or research execution changes. The shared
review components need the same timer fix, including their private use.

Acceptance: a pending list, detail, review or permission read survives multiple
background timer/event ticks and eventually displays its result. After completion
the next poll proceeds normally. Explicit refresh still supersedes an older read;
late results cannot undo denial or access withdrawal. Saved content and read-start
freshness are preserved. Run actual mounted-reader regressions, normal client
checks/build and exact Sites publication; no live dossier or provider replay.

Implemented in four shared reader components. Background timers and research
stream events call stable ResourceReader.poll functions; explicit refresh tokens,
user actions, session resets and access fences keep their superseding behavior.
The review readers retain their own existing timer, including permission reads.
No hook, endpoint, timer interval or research execution path changed.

Validation: 484 tests pass in each client. After making callback bindings explicit
for the React compiler, all four affected mounted-reader regressions pass again,
as do lint, type checking and diff checks. The tests hold reads open across 45
seconds and stream events, accept their eventual results, resume polling, and
verify explicit refresh and late-response refusal after denied/withdrawn access.
Independent read-only review found no blocker. Normal builds and exact published
versions are recorded in the parent release checkpoint. No provider or production
research calls were made, and no accepted dossier was replayed.
