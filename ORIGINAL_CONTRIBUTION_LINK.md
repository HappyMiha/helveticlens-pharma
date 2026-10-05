# Inspect the URL submitted for private research

Scope recorded 5 October 2026: the existing Original contribution reader omitted
the URL already retained by the authorized API. A URL-only contribution with a
queued or failed read has no captured source card, leaving its destination absent
from this reader. The reference remains stored elsewhere in the dossier.

Show the submitted HTTPS link independently of capture success, with original
authorship, text and file download unchanged. Reuse sourceReference validation;
unsafe or credential-bearing URLs receive no link or raw-value disclosure. The
link opens the current webpage explicitly and is distinct from retained passages
and research reading status. No automatic fetch, AI call or publication occurs.

Acceptance: exact URL path, query and fragment remain in the link; original-file
downloads remain scoped; unsafe/malformed addresses are withheld; missing URLs
add no placeholder. Existing original-contribution rendering checks cover these
cases. Core, source rights and research results are unchanged.

Validation: all 521 client tests, lint and type checking passed. The existing
original-contribution regression now covers the submitted URL and rejected
addresses; independent review approved the change. Exact build and production
activation are recorded in the release receipt.
