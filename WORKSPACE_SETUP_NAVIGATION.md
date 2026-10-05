# Keep the chosen dossier setup open

Scope recorded 5 October 2026: entering a new dossier or the current dossier's
setup while a previous dossier read is pending. Workspace already fenced reads
by a navigation generation, but these two setup transitions did not advance it.
A late success therefore replaced the form and discarded its local draft; a
late failure could surface an error from the abandoned destination.

Entering setup now invalidates the earlier navigation. The existing guards drop
both obsolete results and errors. Creating a dossier still requires the current
role: a denied creation attempt does not cancel an otherwise valid read.
If browser history has already changed the URL during a pending read, selecting
the visible dossier's setup records that dossier again so reloading the page
cannot open the abandoned destination. Normal setup keeps its existing URL.

The change uses the existing navigation generation and API. No Core, research
execution, provider, storage, or model change is involved. Four mounted Workspace
regressions cover retained new-form text after success/failure, setup while a
history navigation is pending, and denied creation. The first three failed
against the previous implementation and pass after the correction.

Validation: 532 tests per client passed. After the test-only string-matching
style correction, all four new regressions passed again; lint, TypeScript and
diff checks passed. Independent read-only review found no scoped blocker.
The final production build is performed by the publication workflow.
