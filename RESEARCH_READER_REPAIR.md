# Research reader repair — 1.36

The research notebook's saved-evidence search and claim history had identical
sibling React keys. After a failed read and retry, React could leave an orphan
search form. Keys now include the component's identity and still reset when the
dossier or user changes. A real React reconciliation regression reproduced two
host search inputs before the fix and retains one after repeated failure/retry.
The entered question survives reloads in the same dossier.

Reload saved research reads saved state only. Loading is visible and an existing
error remains until a successful response. Gateway HTML errors now explain
platform unavailability; connection, session, permission, missing item and rate
limits remain distinct. Uncertain actions are never automatically repeated.
Malformed successful replies fail explicitly instead of appearing empty.

The unit fixture uses stateful child readers, the actual research notebook and
the pinned React renderer; it is not a private production session or browser QA.
Publication and complete test results are recorded in the shared Core release
receipt. Existing permissions and external-search consent remain unchanged.
