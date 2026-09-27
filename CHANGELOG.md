# Changes

## 1.12.0 — private team monitoring

Choose the monitoring audience when starting a dossier: accepted team members or everyone in the workspace. New setup defaults to the invited team; existing activated dossiers keep their audience. Private monitoring covers native topics, matching evidence, dossier research, current-recipient feeds and consented digests. Removing a member closes future access and redacts private topic content from previously saved digest views in the product. Already delivered email cannot be recalled.

Private source URLs remain dossier research references. Workspace page watches are unavailable in this mode; approved-feed topic monitoring continues. Shared workspace AI briefs exclude private monitoring context. Dossier Owner plus native workspace administrator rights are still required to activate monitoring. Public publication remains an explicit, separate owner action. Invitations outside the workspace and living public research remain later stages.

## 1.11.0 — dossier teams and accountable invitations

The original creator can enable Owner, Editor, Contributor and Viewer roles, invite existing workspace colleagues, revoke invitations and hand over ownership. Account-bound invitations expire in seven days and appear in an in-app inbox; no email is sent. Saved drafts open as research dossiers before monitoring activation. Contribution controls use dossier roles, and activation explicitly discloses sharing with the entire workspace. Active monitoring keeps its existing workspace audience. Members-only active monitoring and invitations outside the workspace remain future work.


## 1.10.0 — original contributions become private evidence

One dossier composer saves comments, source URLs, files, corrections and research requests with original authorship and queues a durable private review. Exact text/file hashes and original downloads survive failed extraction or inference. Reviews serialize per dossier; failed steps can be retried without repeating completed work. Contribution research cannot send private material to public discovery or expand source entities into public queries. Existing explicit Ask remains available.

Local extraction supports bounded TXT, Markdown, CSV, HTML and text PDF. Unsupported or scanned files remain downloadable with explicit limitations. Both products show original contributions, attributed sources, queued/live progress, partial failures and recovery through the existing research interface. Existing native permissions and explicit public publication remain unchanged. Full per-dossier invitations, living public research and cross-run reconciliation remain later stages.

## 1.9.0 — a research-first visual language

A shared light/dark design foundation replaces the blue/purple dashboard palette with neutral research surfaces, strong typography, large evidence counts and restrained glass navigation. Cmd/Ctrl+K opens one floating Ask/Search on every route. It searches public dossiers anonymously, current authorized workspace knowledge, or deliberately submitted public-web questions using automatic Jev/Laya routing. In a dossier it starts the existing durable investigation without model or agent setup. Typing alone never sends a query. Existing detailed search tools remain accessible.

The reference dossier reads as a research document: the question, claims with exact quotes and contested history, prominent source objects with usage links, retained-source reader, timeline, open research paths and a “How was this produced?” panel. Unknown publication dates and primary/secondary classification stay explicitly unknown. Lens activity reflects only recent, persisted in-flight search/read/extraction steps, and disappears on pause, failure, completion or stale checkpoints. Reduced motion retains a static treatment and the same readable state.

Keyboard-accessible command and source dialogs reuse existing primitives. Navigation collapses on tablets, mobile source readers fill the screen, and the floating search remains reachable. Theme preference is device-local; queries and private evidence are not stored in browser storage. Existing native authorization, provider setup, data, source rights and publication boundaries are unchanged. Full dynamic-dossier and native-platform page migration remain ongoing.

Validation: 77 client tests, lint and strict types pass in both products; the seven new behavior checks cover real/stale Lens activity, evidence counts, source metadata, global availability and transparency. Sixteen authored theme color pairs exceed 4.5:1 contrast. Production build and exact deployment checks are recorded in the shared release evidence. Browser interaction and whole-page visual QA are not claimed.

## 1.8.1 — reconnect to saved investigations

Refresh reloads the dossier investigation list and selects current running work, including when the initial list failed or a start response was lost. An investigation started by another editor can be found without reloading the whole workspace. Failed reads clear the displayed research; retrying the question preserves its request identity. The same 70 client contracts, lint, strict type check and production build apply.


## 1.8.0 — durable dossier investigations

The primary dossier view now starts with **Ask this dossier**. One submitted question queues native, persistent research using the existing search, Jev/Laya routing, source reader and configured workspace AI. Available sources shape the plan; a source-grounded entity can create another branch and a new plan version. No agent roster or model selection is required.

Claims link to exact validated quotes, locations and source hashes. Contradicting evidence preserves the earlier statement and status history. Entity mentions remain unresolved identities; model extraction is not independent factual verification. Saved sources, branches and structured activity survive restarts. Pause, resume and cancel operate on the durable job generation. In-flight paid searches are not automatically repeated after interruption. Native permissions are rechecked before and after external operations and during event streams.

Research has explicit bounds: up to three public branches with three inspected sources each, plus three saved evidence snapshots. Daily public queries share the existing operator budget. Unavailable capabilities and failed steps remain visible. Discussion, files, monitoring, actions and explicit public publication remain under **Discussion, monitoring & dossier tools**.

This release is the first working stage of the supplied dynamic dossier specification. Per-dossier invitations, human-readable living public URLs, automatic file extraction and contribution/monitoring-triggered investigation are still open; this release does not silently publish private research.


## 1.7.0 — Reviewed multilingual search

The public question can now include two editable alternative queries. An optional text-model draft supports English, German, French, Italian and Ukrainian; users review and explicitly apply suggestions before searching. Retrieval uses at most five visible lanes and one deduplicated candidate pool. Jev/Laya still judge relevance against the main question, while exact found-by queries survive signed import, brief and export. Daily limits count query units and retries preserve their original identity. Manual queries remain usable when the draft model is unavailable. Private corpus indexing and scheduled rediscovery remain separate work.

## 1.6.0 — Federated semantic discovery

Public-query web discovery now combines Google, Bing and, in Pharma, Europe PMC. Jev and pinned local multilingual Laya share a validated decision interface; automatic failure fallback and explicit comparison use the same retrieved candidates. Hybrid semantic/BM25/index ranking, measured latency, honest usage/cost fields and private relevance-label evaluation make ordering inspectable. Bounded source reading finds relevant passages and outgoing links for further research. Private saved results, replay identity, explicit disclosure, source provenance, account erasure and quotas protect the complete journey. Jev needs funded TypeSafe access; unavailable providers are shown, not simulated. Production activation is recorded separately.

## 1.5.0 — Personal following and private working copies

Personal following now has a private paginated library, public-change markers, explicit acknowledgement and withdrawal/deletion handling. Reviewed private reuse creates a native author-private draft with the complete public snapshot, attribution, source links and origin preserved. Exact signed previews, current membership, CSRF, revisions and durable retry tombstones protect the operation. No monitoring, fetching, publication or email starts implicitly. Exact production activation is verified separately.

## 1.4.0 — Public discussion

Published dossiers now have a public discussion. Anyone can read; current account members can deliberately submit a reviewed public display name, text and up to ten HTTPS source links. Authors can edit or remove their own contributions. Dossier workspace administrators can hide or restore contributions with a reason, while author edits preserve a hidden state. Public and personal views have real counts, 20-item pages and failure recovery. Sign-in reuses the existing native account flow on the reader. Private dossier discussions stay private.

Consent, current sessions/memberships, CSRF, publication/comment revisions and durable retry identity are enforced by the shared core. Withdrawal closes the discussion; parent and account erasure remove contained contributions. Hidden text and private moderation history are never part of anonymous reads. Following, private reuse, open-web providers, semantic retrieval and new scheduled delivery remain subsequent cycles.

## 1.3.1 — Public reader runtime correction

The server-rendered public catalogue and reader use the edge runtime’s supported manual redirect policy. Unexpected upstream redirects remain unavailable and are never followed. The API and public/private content boundaries are unchanged. This correction follows a failed live SSR check of 1.3.0; production activation is verified separately.

## 1.3.0 — Public dossier publication

Authors can prepare a separate public version of a private dossier, preview its exact text and source links, then explicitly publish it. Anonymous readers can search the public catalogue and open permanent server-rendered pages. Updates require a new preview; withdrawal immediately removes the version from application reads. Revisions and publication consent are retained in the private audit. Existing files, client context, discussions and monitoring settings remain private.

Publication has revision-conflict protection and retry identity. This cycle adds no public replies, subscription emails, automatic publication, external web provider or semantic ranking. Exact production activation is recorded separately in the shared release evidence.

## 1.2.0 — 27 September 2026

This release develops the professional monitoring loop around a shared question: discover sources, inspect evidence, develop an answer together and return to it when the underlying material changes. The product guide at `/guide` explains the complete workflow and common recovery paths using this product's own subject and examples.

- **Discover deliberately.** Reviewed AI search plans, literal all-word or exact-phrase workspace search, title relevance, explicit Fedlex and Europe PMC continuation and shared saved searches with purpose.
- **Keep provenance.** Imported catalogue records retain the validated query, provider, page and retrieval time. The source library retrieves older references with true counts and current source-review filters. Exact private source links survive reload and sign-in.
- **Choose and inspect AI evidence.** Attributed URL review decisions influence new research. Review the bounded AI input set before generation; changed evidence requires a fresh preview. Citations and previews open the exact accessible saved document, with bounded reading, capture details and revision-conflict recovery.
- **Develop questions together.** Search older questions by title/context, filter open questions and working answers, keep complete pages and retry an exact question after failure. Delayed reads cannot reopen a view that was left.
- **Make reviews accountable.** Accepted answers show specific new-material, corrected-evidence and unavailable-source reasons. Explicit reconfirmation records the reviewed state without rewriting historical research notes.
- **Follow through.** Actions can originate from a question or a specific saved AI gap, retain that origin and show responsibility, deadlines and outcomes beside the discussion.
- **Understand monitoring health.** Page watches distinguish attempts, successful checks and saved versions, with visible failures, queue/schedule state and explicit recovery controls.

### Coverage and release state

The shared HelveticLens platform retains identity, private organisation/product boundaries, source collection and delivery. This release adds no universal web index, automatic acceptance, public community, standalone per-dossier email channel or attachment parsing. Current source coverage, human judgement and operator readiness still govern the result. Exact quotes establish traceability; they do not certify medical or legal conclusions.

The 1.2.0 source and validated builds are prepared for the final production publication on 27 September. A repository push alone does not prove deployment. Production activation is recorded separately after publishing and verifying the exact builds; the shared platform's `BACKLOG_MONITORING_V2.md` records the corresponding native release evidence.

### Validation

Each client has 44 automated contracts, plus authored-source lint, strict TypeScript and production builds. The shared product API has 151 integration cases and the backlog smoke gate (152 checks together), covering persistence, privacy, failure handling and evidence boundaries. These checks do not constitute browser interaction QA or an external professional pilot.

## 1.1.0 — initial collective research release

Initial collective research release: private living topics, questions and attributed replies, evidence-linked AI research notes, human-accepted working answers, product-specific work context, actions/reviews, original-source references, files and private briefs/exports, on the existing HelveticLens monitoring platform.
