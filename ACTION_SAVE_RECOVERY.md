# A saved action remains saved when refreshing fails

Scope recorded 5 October 2026: the shared action dialog in dossier, discussion,
work queue and follow-up flows. A successful POST/PUT followed by a rejected
onSaved callback previously left Save action enabled. Updating again submitted
the obsolete revision and failed, although the user's first change was retained.

Record acknowledgement immediately after the existing API confirms the write.
Freeze the acknowledged form, show Action saved, and offer an explicit refresh
of the saved view or Close. Read recovery never repeats the mutation and remains
available when edit permission or assignee loading changes. Unacknowledged errors
retain the current draft and creation key; current edit permission gates writes.
Concurrent submissions share one active operation. Leaving the dialog prevents
late completion from refreshing or closing another dialog.

The parent resource readers can expose errors while resolving their refresh
promise. A resolved callback is therefore not proof of a current work queue;
the acknowledgement promises only that the action was saved. Existing reader
error surfaces, revision checks and source/evidence authority remain unchanged.

Acceptance: failed refresh after acknowledged create/update; repeated read-only
recovery; mutation rejection preserves draft/key; revoked write permission;
duplicate submit and unmount while awaiting write or refresh. No Core change,
research run, provider request, production fixture or email is required.

Validation: all 528 client tests passed, including seven new mounted regressions.
After replacing the status paragraph with semantic output, all seven focused
regressions, lint and TypeScript checks passed again in both clients. Independent
read-only review found no blocker. The publication workflow runs the final build.
