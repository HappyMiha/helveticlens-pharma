# Research entry and durable topic suggestions — 1.103

Search-result and example creation now open the one-question research flow with
exact question wording. Manual topics/source setup is an explicit choice; switching
into it preserves the current question and any separate selected-source metadata.
Existing saved drafts retain their own setup and are never recreated through research
admission. An uncertain research start retains its request key and blocks switching
to another creation path.

Manual topic suggestions use Core's authenticated, actor-private POST/GET
`/monitoring-profiles/{id}/suggestions` job contract. Enqueue returns immediately;
waiting and running work survives leaving/reopening the page. Completed proposals
retain their exact IDs and still need explicit acceptance. Busy inference waits in
the existing interactive queue instead of failing the page. Failed reads retry reads;
lost enqueue responses reuse the same request key without resaving the profile.

A conflicting profile revision requires an explicit saved-version reload, with a
clear notice that this replaces unsaved setup edits. Background results preserve
local edits, advance only the acknowledged saved revision and prevent acceptance
of proposals whose saved question/context differs from the form. A save cannot mark
newer concurrent edits clean.

Verification: mounted tests cover both real search entry paths through Workspace,
Wizard and ResearchStart, exact /explore payloads, manual transitions, existing drafts,
uncertain admission, durable queued/completed reads, duplicate clicks, lost replies,
conflict recovery and unmount safety. No test submits a production research request.
Required client tests, lint, type checking and builds accompany the published version.
Core worker/access/lease coverage and release boundary: `docs/PRODUCT_TOPIC_SUGGESTIONS.md`.
