# Research notebook navigation

## Confirmed problem and scope

A dossier retains its last request to open an investigation or cited source.
Choosing a different investigation in the notebook did not invalidate the
pending focus read. A late success could reopen the old investigation; a late
failure could put its error over the newly selected answer. Returning manually
to the old investigation could also replay the obsolete source anchor.

The same selection boundary applies to background reads and delayed control
failures. Starting research or explicitly reloading saved work is a new navigation
intent, but must still respect a later manual choice. Successfully created work
must remain acknowledged and available in history even when it is no longer the
selected investigation.

## Acceptance

- The latest user selection owns the notebook, including A → B → A navigation.
- Late focus results, errors and anchors cannot supersede that selection.
- A new explicit request to open an investigation or source still works.
- Delayed control failures cannot refresh or annotate another selected answer.
- Existing access checks, higher-revision protection and paired activity read
  timestamps remain in force.
- Real mounted-component checks exercise delayed HTTP responses; required client
  tests, lint, types and production build pass before publication.

Both clients use the existing Core API. This change requires no new research,
provider calls, production fixtures, data migration or Core deployment.

## Implementation and validation

A navigation generation is captured by focus and refresh reads, start/reload
operations and controls. Manual selection updates its current identity immediately.
Source reveal requires the still-current focus request and access epoch. Successful
starts always remain acknowledged and in history, while only the current intent
may select their result.

Both clients passed 491 tests, lint and typecheck on the final implementation.
The 11 mounted notebook cases include seven new navigation scenarios alongside
existing reconciliation, revision and activity checks. Independent code review
found no blocker. Production build and exact Git/Sites publication are recorded
in the deployment receipt outside the source repository.
