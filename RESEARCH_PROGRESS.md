# Consistent dossier research activity

Scope: Legal and Pharma reader-only correction, 5 October 2026. The research
notebook and public research view must use the same server-confirmed activity as
the main exploration page. A long live operation must not be marked idle solely
because its original step is older than 95 seconds. Keep the current layout,
answer, source rights and immutable research unchanged; no extra progress panel.

Dependencies/readiness: current Core research-activity/v1 receipt, existing
CurrentResearchReceipt display and ResourceReader request-start timing. Modern
records must never fall back to branch text when receipt/access is unconfirmed.
Retain the conservative legacy presentation for older records without exploration.

Acceptance: final briefing has its existing readable label; a fresh receipt can
show an older live operation; delayed responses, expiry, pause and access changes
cannot imply live work or reveal stale details. Expiry must not fetch or hide the
saved answer. Associate request start atomically with the accepted value and keep
it when a lower revision is rejected. Reuse existing polling and inference paths.
Run client tests, lint, typecheck and build, then normal publication of the exact
source for each existing public Site. Do not rerun accepted dossiers or Core gates.

Implementation: the existing receipt-only component is shared by all three reader
surfaces. Notebook data and monotonic request start are accepted together; lower
revision responses cannot replace them, including focus and control requests.
Public initial/SSR data receives no invented freshness timestamp. Legacy data
keeps its conservative display and gains the existing briefing label.

Validation: all 480 tests pass in each client, including six new rendering and
request-race cases; lint, type checking and diff checks pass. Actual mounted
notebook checks cover response delay, receipt expiry with no network request,
retained answers and a delayed focus response after pause. Public initial rendering
cannot activate an unconfirmed receipt. Independent read-only review approved the
final change. Production build and exact Sites activation are tracked separately
in the parent checkpoint. No research was started or replayed and Core is unchanged.
