# Acknowledged source decisions survive a failed view refresh

Scope recorded 5 October 2026: the source review dialog. A source decision can
be saved successfully before the parent dossier refresh fails. Previously the
dialog then looked like a failed save and exposed its old editable form. Editing
rotated the request key but retained the old expected_review_id, producing a
legitimate conflict against the already-saved decision. The Core's unchanged
same-key idempotency already prevented duplicate records.

The dialog now records the returned decision before refreshing its parent. Once
acknowledged, the submission cannot be edited or sent again. A saved status and
explicit view-refresh retry remain available without current edit permission.
This retry only invokes the existing read callback. The earlier current-decision
badge is hidden, and the retained history is identified as potentially earlier.

Current history errors still remove the loaded data; acknowledgement does not
restore it or bypass access checks. Before acknowledgement, existing conflict,
edit permission and explicit rebase behavior remain intact. Uncertain writes keep
their decision, explanation and request identity. A synchronous guard prevents
concurrent submits, and leaving the modal suppresses late refresh/close callbacks.
Resource refresh can resolve with an error, so the UI promises only a saved write,
not a successfully refreshed dossier.

Six mounted regressions exercise acknowledged refresh retries, revoked history
and edit access, uncertain-write recovery, immediate duplicate submits, and both
unmount boundaries. They use the actual API and resource reader with local fake
responses; no production records, research runs, providers or emails are used.

Validation: all 538 tests per client, lint, TypeScript and diff checks passed.
The publication workflow performs the final production build.
