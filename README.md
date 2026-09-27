# HelveticLens Pharma

[Production](https://pharma.helveticlens.ch) · [Apache License 2.0](LICENSE) · [Shared platform](https://github.com/HappyMiha/helvetic-lens)

A dedicated pharmaceutical monitoring workspace based on the HelveticLens platform and the September 2026 Legal Hackathon workflow.

Describe a monitoring question → review AI topics → select primary sources → choose delivery → start a collaborative dossier.

Read the [product guide](https://pharma.helveticlens.ch/guide) for the working loop and recovery paths, and the [1.8.1 changes](CHANGELOG.md) for this release.

See [the product model](PRODUCT.md) for the research loop, intended users, coverage and pilot measures.

## What works

- **Ask this dossier** starts durable research from one question. The coordinator selects available search/read capabilities, checks saved evidence, and follows new public-source entities through versioned plans. Captured excerpts, evidence-linked claims, contradictions, unresolved entity mentions and relationships remain inspectable. Pause/resume/cancel and a live event stream use native authorization and persisted checkpoints. The question and public entity names go to external search; private saved material is never converted into external queries.

- Public dossiers at `/public-dossiers`: anonymous catalogue, literal search, paginated results and server-rendered readers. Administrators explicitly author and preview a separate public version, confirm publication, update it or withdraw it; private material is not copied automatically.

- Living professional topics with focused questions, attributed source-linked replies, team-accepted working answers and reopening. Private title/context search retrieves older questions with actual answer-status counts, complete pages and exact-question retry.
- Reviewed AI search plans turn a question into up to five source-specific queries and scope clarifications. Only the entered question reaches the configured AI; choosing a suggestion prepares an editable search without contacting a public source.
- Team search matches all words across each record’s fields or an exact phrase, prioritizes title matches and shows real matching totals when the visible results are capped.
- Workspace discovery plus explicit Fedlex official title search and Europe PMC literature lookup. Search results seed a topic or become saved references.
- Evidence-grounded AI research notes with exact quote checks, source snapshots, open gaps and manual acceptance.
- Accountable actions created directly from questions or specific AI evidence gaps, with an immutable research origin, owners, deadlines and outcomes visible beside the question.
- Review rhythm, team/personal work queue, links back to the originating question and a private printable topic brief.
- Existing HelveticLens sign-in and registration, organization permissions and server sessions.
- Durable five-step drafts, real configured AI proposals, manual editing, source recommendations restricted to the real catalogue, saved-evidence previews and idempotent activation.
- Organization- and product-scoped dossiers with original-source links, comments, files, relevance feedback, export and activity history.
- Explicit Fedlex and Europe PMC result pages with source-reported totals where available, previous-page recall, retained results after failed requests and a visible 1,000-record refinement limit.
- A complete private source library with 30-reference pages, literal keyword search across saved and imported metadata, current-review filters and real counts. Older references remain discoverable as discussion activity grows; source provenance, review history and page-watch controls stay together.
- Attributed source reviews let the team include, exclude or reset an exact URL for new AI research within a dossier. Current decisions, paginated history, conflict protection, preserved explanations and brief/export evidence keep the review accountable. Previous answers and monitoring continue unchanged.
- Public-result imports retain server-validated query, catalogue record, page and retrieval time. Search provenance appears beside sources and survives the topic brief and JSON export; catalogue metadata is distinct from a full-text snapshot.
- Shared saved searches with query, provider, match mode, purpose and author; teammates review and edit before explicitly searching again. Recipes remain private and are included in the topic brief and export.
- Native scheduled Swiss source collections and individual-page watches with real fetching, retained evidence, separate attempt/success times, queue/schedule status, visible failures and explicit retry, pause/resume and daily-check controls.
- In-app evidence and the existing verified-email daily/weekly personal organization digest.
- Team invitations and viewer/administrator roles. Drafts remain author-private; activated dossiers are shared within the current organization.
- AI improvements based on bounded saved feedback. Applying a reviewed suggestion creates a native topic revision; stale proposals cannot overwrite current monitoring.

## Personal following and private reuse

Follow a public dossier from its reader and return through **Followed dossiers**.
The list belongs to your native account across workspaces, including for viewer
members. It has real counts and 20-item pages. Published revision changes and
visible discussion changes produce an unseen-update marker. Refresh explicitly;
acknowledging an old marker cannot hide newer changes. Hidden edits produce no
public signal. Withdrawal redacts the content; deletion removes the follow.
Following does not send email or change digest preferences.

Workspace administrators can preview and confirm a private working copy with
their own name and monitoring question. It is an author-private native draft,
with no activated topics or source subscriptions. The complete reviewed public
snapshot, author label, public URL/revision and SHA-256 remain inspectable in
setup, the working dossier and JSON export. Published source links become reference
entries. The snapshot is independent of later edits or withdrawal. Private parent
material, public contributions and linked document contents are not copied. Source
rights remain with their owners. Native setup and delivery consent still apply.
Signed previews expire after 30 minutes and bind exact content, user, workspace
and session. Durable retry receipts prevent duplicate drafts, including retries
after deletion. Account erasure removes personal follows and reuse receipts.
Open-web discovery and multilingual decision ranking are described below. New recurring
query monitoring and semantic workspace indexing remain separate cycles.

## Public discussion

Each published dossier has an anonymous reader and public contribution stream. Current native account members, including workspace viewers, can publish personal contributions after reviewing their display name, text and HTTPS links. Authors edit/remove their own work; dossier administrators moderate visibility with reasons. Hidden text is visible only to its author and the dossier administrators. Existing private workspace permissions are unchanged. Public following and private reuse are described below. Open-web semantic discovery is described below; public reading does not submit a query.

## Open-web semantic discovery

Use **Open web · Jev + Laya** in Find sources. Review a public query, choose
Quick (8 candidates), Broad (24) or Deep (36), and confirm disclosure before
searching. Google and Bing provide independent web results; Pharma also includes
Europe PMC literature in Broad/Deep modes. A multilingual Laya decision model or
hosted Jev judges query–source relevance. Reciprocal-rank fusion combines that
ranking with BM25 exact-term matching and the search indexes. This discovers
sources beyond the scheduled Swiss catalogue; it is bounded retrieval, not a
complete index of the internet or semantic search of private workspace files.

Open **Broaden the search** to add two editable alternatives: synonyms, official
terminology or another language. **Ask AI for editable alternatives** drafts one
or two queries in English, German, French, Italian or Ukrainian after explicit
question/language disclosure. Review the draft before placing it into the fields.
Only pressing Search retrieves sources. The main question drives relevance
judgments, with one shared result limit across at most five retrieval lanes.
Each source shows the exact queries that found it; signed imports preserve those
queries in the dossier, printable brief and JSON export. Failed lanes are visible.

Auto uses Jev when configured and falls back to local Laya on provider failure.
Compare ranks the same candidates with both configured engines. Decision latency,
model identity, available token usage, cost estimates and confidence remain
inspectable. Relevance labels produce agreement/accuracy and Brier score on your
reviewed sample; unreviewed accuracy and unavailable cost stay unknown. Laya mode
keeps decisions local but still sends the main question and alternatives to remote
search indexes.
Provider credentials belong to the shared core, never the client.

The last 50 searches per account/product/workspace remain private. Reopening a
result does not repeat paid retrieval or renew its 30-minute source-import window.
Searches and labels are removed with account erasure. The platform defaults to
25 query units/day across all accounts: a main query plus two alternatives uses
three units, and an identical request retry is counted once. This bounds requested
queries, not exact provider billing. Unavailable credits or engines are visible.
Hosted Jev and local Laya are active in the verified 1.6.0 production release;
configuration alone never establishes continued availability.

**Read public source** explicitly fetches up to three results per search, respects
robots and access restrictions, and shows up to three extracted passages with
capture time/hash and up to 20 outgoing links. Following a topic link prepares an
editable new query. Links are not certified citations, and relevant snippets are
not factual verification. Saving a source uses the existing signed provenance
and review workflow; creating a monitor still requires the normal setup steps.

## Architecture

This repository owns the product interface and a bounded, same-origin API gateway. The Apache-2.0 [HelveticLens platform](https://github.com/HappyMiha/helvetic-lens) owns identity, PostgreSQL, encrypted provider settings, persistent evidence, workers, source collection and email delivery. Backend implementation: `services/api/helvetic_lens/product_api.py`, `product_research.py`, `product_operations.py` and `product_models.py`; schema through migration `f9c495bef124`. The two products share that core while their dossier lists are separated by product and organization.

No production records, credentials, provider keys or uploaded files are stored in this repository. The browser never chooses the upstream origin. The gateway forwards only HelveticLens session/CSRF cookies, preserves HttpOnly cookies, checks mutation origins, bounds streamed uploads and sends private responses with `no-store`.

## Development

Node.js 22.13+ and pnpm. Dependencies are pinned in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm dev --port 3141
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Production defaults to the existing `https://helveticlens.ch` core. For a separate self-hosted installation, first deploy the upstream platform with the product-dossier migration and its documented production protections, then configure `HELVETICLENS_API_ORIGIN` as a server-side environment value. The core's SMTP, source access, model configuration and worker readiness remain required; this is not a browser-only demo.

## Deployment

`.openai/hosting.json` identifies this product's own Sites project. Vite/Vinext builds a Cloudflare-compatible Worker under `dist/server`, with client assets in `dist/client`. Publish only a validated build of the exact source commit. Configure custom-domain DNS using the deployment provider's returned validation records. The public interface retains application authentication for all private data.

## Coverage and review boundaries

Scheduled source coverage is the platform's actual Swiss catalogue. Extra jurisdiction names do not create coverage. Additional page watches monitor that URL rather than crawling the whole regulator's website; dynamic or unavailable pages may fail visibly. AI drafts are proposals, not verified medical or legal findings. Current-source interpretation and external usefulness assessment require professional review.

Email choices change the current user's personal organization digest, not an independent mailing list for each client. Topic pause leaves shared source collection and document watch settings separate. Attachments are private downloads (10 MB each, 50 per dossier, 500 MB per organization), not automatically parsed or sent to AI. Current UI language is English; the full platform retains its existing languages and expert settings.

## Verification

Production builds, strict TypeScript and authored-source lint are required before publication. The client has automated checks covering the private gateway, session/CSRF/product boundaries, downloads, literal search and displayed-query pagination, import retry identity, review conflicts, source status, exact source/question navigation, saved-document revision guards, reviewed AI inputs and explicit answer reconfirmation. Delayed question responses and stale errors are tested through cancelled and superseded reads.

Native backend tests exercise real persistence, access control, source/model boundaries, migrations, monitoring admission, evidence provenance, exact citations, accountable actions, source and answer review, complete question/source retrieval and recovery. Validation results and the distinction between pushed code and active releases are recorded in the shared platform's `BACKLOG_MONITORING_V2.md` and `docs/PRODUCT_DOSSIERS.md`. Passing automated checks does not constitute a clinical/legal review or a user pilot.

Vendored UI primitives and the generated mobile hook retain their upstream source. Lint excludes those generated files; all authored product code remains under the strict project rules.

## License

Apache-2.0 for the project code, with preserved upstream attribution in [NOTICE](NOTICE). Third-party libraries and source documents retain their own terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
