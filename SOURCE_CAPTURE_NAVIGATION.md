# Earlier captured sources

The duplicate-source reader linked to `source-ID` even in Sources & files, where
cards use `dossier-original-ID`. That could target a hidden notebook instead of
the current source collection. Following the same link inside the modal reader
also left the destination behind the open sheet.

The action must resolve an earlier capture within the authorized source collection
and current card namespace. It opens retained excerpts, reveals their enclosing
section and moves reading focus to that capture. In the modal reader, closing the
sheet must precede the focus handoff. Ordinary close retains its normal focus
behavior. Missing or self-referential destinations have no enabled jump.

This is client navigation only. Exact excerpts, source metadata and fingerprints
remain unchanged; it makes no source fetch, research request or Core change.
Acceptance covers both source namespaces, inline and sheet navigation, absent
destinations and preserved evidence. Required client checks and publication
receipts record final validation.

## Validation

Both clients passed 497 tests, lint and typecheck. Thirteen focused source-reader
checks cover exact source metadata and six added cases for both anchor namespaces,
missing targets, inline reading, modal focus handoff and removal before handoff.
The modal checks mount the real SourceCard against the pinned Sheet open/finalFocus
contract; they do not claim browser animation testing. Independent code review
found no blocker. The exact production builds and publication are recorded in the
release receipt outside these repositories.
