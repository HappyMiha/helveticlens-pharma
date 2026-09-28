# HelveticLens Pharma — product model

Current release status and workflows are maintained in [README](README.md) and
the production product guide. The founding product model below records the
initial workflow and its original limits; subsequent releases add dynamic
investigations, open-web and semantic search, roles, personal following and
recurring monitoring. The legal product is now **Helvetic Lens Legal**.


## The job

Help regulatory affairs, pharmacovigilance and medical teams keep a shared answer to an important question current, with evidence they can inspect. The product follows medicines, safety, evidence and regulatory change. The working audience is a small professional team using a private organization workspace.

A concrete starting question: **What new evidence could change our assessment of this medicine?**

The main unit is a **living topic**: a monitoring dossier with a shared goal, focused questions, original sources, attributed contributions, working answers and a monitoring configuration. Search starts the work; the topic preserves the understanding. The product does not claim to index the entire web.

## The working loop

1. **Ask and discover.** Optionally ask AI to break the entered question into up to five searches, each with a source, editable terms and a reason. Review suggested scope clarifications and remove confidential details before external lookup. Selecting a suggestion only prepares the search; press Search to run it. Search existing team knowledge first. Choose Fedlex official title search or Europe PMC literature search for external discovery; only the submitted phrase is sent to that provider. Open source records to inspect scope and status.
2. **Create a monitored topic.** The existing five-step setup saves drafts, asks the configured AI for topics and source suggestions, previews saved evidence, records delivery consent and activates native monitoring. Search results can seed this setup with a source.
3. **Develop it together.** Open focused questions. Contributors attach source links to replies, compare interpretations, add private files and preserve provenance. Administrators contribute under the platform's existing role model; viewers read.
4. **Research with evidence.** AI drafts a note using bounded snapshots from the topic: team contributions, saved page extracts and event metadata. Every finding includes a known source and an exact quote, checked before saving. The note also shows unknowns and suggested search phrases. Source relevance and professional interpretation still need review.
5. **Accept a working answer.** A person selects an answer; AI cannot accept itself. The answer stays linked to its evidence and can be reopened as information changes. New saved material prompts a review of an accepted answer.
6. **Act and improve.** Create follow-up directly from the question or a specific AI evidence gap. Review the draft, assign responsibility and a team deadline, then record an outcome. The server preserves the originating question and exact saved gap; the question shows its own paginated actions and outcomes. Completing an action leaves answer acceptance to the team. Schedule topic reviews. Research gaps can be carried into a monitoring improvement proposal; a reviewed change creates a native topic revision. Monitoring continues and provides the next evidence.

## Product surfaces

- **Topics:** collective research homepage, visible topic activity, unanswered-question counts, workspace and external discovery.
- **Questions & discussion:** attributed threaded contributions, AI research notes, accepted answers, unresolved gaps, next searches and accountable follow-up with recorded outcomes.
- **Monitoring / evidence:** saved native events, match explanations and validity, original sources and collection coverage. Connected pages show last attempt, last successful accepted check, saved-version time, native queue and automatic schedule, with retry, refresh and explicit pause/daily controls.
- **Actions & reviews:** medicine/programme/market/lifecycle context, responsibility, priority, next review and outcomes.
- **Review desk:** paginated team or personal queue; overdue work, unassigned actions and due reviews are calculated from persisted records.
- **Topic brief:** private printable snapshot of questions, working answers, citations, unknowns, actions, decisions and references. JSON export includes structured questions, replies, actions and their research origins; attachments remain separate downloads.

## Trust and actual boundaries

Working content is private by organization and product; drafts remain author-private. Administrators can explicitly author a separate public version in the Public version tab, review the exact text and links, and confirm publication. Anonymous readers can browse, search and open these versions at `/public-dossiers`. Updates require another preview; withdrawal removes the current version from public reads. Existing files, context and discussions are never copied automatically. Public contributions and moderation are available in the public reader; following and subscriptions remain future work. Team invitations retain native permissions.

Fedlex discovery matches catalogue titles, including their source language; Europe PMC discovery returns literature records. Both offer explicit 20-record pages, up to 1,000 provider records per interactive search before refining the query. Europe PMC supplies its total when available. Fedlex groups matching titles by legal work and orders by official identifier; its total stays unknown. Next results uses the displayed query and provider, and previous pages remain available in the current view. Failed requests retain the current results. Live indexes can change between requests; omitted invalid or duplicate records and missing continuation are shown explicitly. Team search matches all entered words across each record’s name/title, content or topic subject; Exact phrase restricts matching to a complete phrase in one field. All-words mode accepts up to 12 distinct words. Both modes treat wildcard characters literally. Results favor title matches within each group and expose actual visible matching totals, returning up to 20 topics, 20 questions and 20 contributions; refine the terms if more matches exist. Neither an empty result nor an AI answer establishes complete coverage.

AI search planning receives only the explicitly entered question and product name; it does not fetch sources or read dossier context. The plan is a temporary draft in the current search view, restricted to the three supported providers and their actual search capabilities. It is not a saved monitoring configuration. AI research opens a read-only preview of the exact question, monitoring goal, model and selected saved excerpts before a separate Generate action. Previewing does not call the model or fetch sources. Literal question-word relevance ranks saved team contributions before recency and the candidate limit; a relevant passage can come from an older contribution or later in its text. The selection remains bounded and may miss evidence. Viewers can inspect inputs; administrators generate notes. If the question, goal, model, source decisions or selected text changes after preview, generation requires a fresh preview. AI research notes receive that bounded topic evidence through the existing organization model provider. It does not autonomously browse the internet. Up to 18 selected snapshots are shown before generation and retained with the note; exact quotation checks establish attribution, not the truth or completeness of a claim. Files are not automatically parsed. Saved source records become watches only through an explicit connection action. Watches follow individual URLs, not entire websites or standing Europe PMC search queries. Failed attempts retain the previous successful-check time and saved evidence. Successful checks older than 48 hours are marked for review; this is a page-check age, not a claim about overall topic coverage. Unknown historical success times stay unknown, and synthetic versions are not labelled as successful live checks. Watch settings affect the same document wherever it is used in the organization; topic matching remains separate.

Saved searches retain a reviewed query, supported provider, workspace match mode and optional purpose with attribution. The shared list has an actual total and 50-record pages. Reviewing a recipe opens editable fields without making a source request; the user presses Search to run it. Saving does not retain full search results, claim verified execution or create scheduled-query monitoring. Recipes are excluded from AI evidence and do not by themselves invalidate an accepted working answer. The private export retains every recipe within the existing export limit; the printable brief includes the latest 50.

Email remains the existing verified, consented personal organization digest, configured during setup. Forum replies and due tasks do not create a separate email subscription. Monitoring pauses, source collection and page-watch switches retain their distinct native behavior. Current UI language is English.

Limits: 500 questions per topic, 1,000 contributions per question, 1,000 actions per dossier; paginated histories. The printable brief includes the latest 50 questions, 100 actions, 20 notes/reviews and 100 references. Monitoring input snapshots and draft answers are historical records and can need review.

Saved-reference search results open the exact private source, even when it is older than the current library page. Source cards offer a permalink containing only dossier and source IDs; it grants no access. Login, reload and browser history preserve the requested record. The focused source shows its saved catalogue provenance, current team decision and existing review/page-watch actions. Inaccessible or failed reads show a retry and a route back to the library, with no stale source left visible. Opening a saved reference does not fetch its original page or start monitoring.

Connected page watches include an in-product saved-source reader. A 20-version history uses native cursors and a visible saved-time cutoff; going back preserves that cutoff, while Refresh includes newer saves. Later corrections/backdated imports can change the list. Read saved text loads at most 50 passages or 16,000 Unicode characters at a time and keeps the server-provided offsets and exact evidence revision. A corrected or reassigned version cannot be silently combined with earlier text; explicitly reload from the first page. The reader distinguishes capture time, declared source date, import/synthetic provenance and selected-article coverage, and labels missing or unreadable extracted text. It does not fetch the live source, generate AI text, change monitoring or record a read milestone. Every page checks current membership, product/private-draft access, the dossier’s monitor link and source/version ownership. Viewers can read. Failed or unavailable reads hide the previous content; the full native evidence-history link remains available.

AI page excerpts now retain the exact connected document and saved evidence revision. Preview cards, research citations and the retained-source list offer **Read saved document**, opening the existing bounded reader with the excerpt alongside it. Opening a preview source does not generate research. Saved-note links resolve the note/question/source identity on the server and enforce current dossier linkage, watch and source ownership; the browser cannot replace the note's target. Changed revisions require explicit first-page recovery. Older notes without recorded revisions are labelled before reading the currently accessible saved version, and their original excerpt/hash stays unchanged. Missing or inaccessible sources remain visible failures with retry. Page candidates whose underlying Law or organization watch is no longer accessible are also excluded from new AI previews/generation. No live fetch, extra model call, public sharing or notification is triggered by reading.

Accepted answers show specific review reasons for new saved material and, for AI page evidence, changed revisions or lost dossier/source access. The original AI note stays intact. Each explicit acceptance/reconfirmation records the current page-evidence metadata in the existing attributed private review audit. Acknowledged absence stays an acknowledged limitation; restored access or another correction triggers a fresh review. Older accepted notes without a baseline compare their captured revisions when available, or request one review when the revision was never recorded. Reconfirm sends the displayed review fingerprint and refuses changed evidence/material with a refresh instruction. Reading or refreshing does not reconfirm, fetch sources or run AI. The printable brief uses the same reasons, and private export retains the review audit. This checks saved evidence and current access, not external completeness or professional correctness.

Older questions remain discoverable inside each topic through a private title/context search. It matches all submitted words literally (up to 12 distinct words and 300 characters), puts title matches first and retains 30-question pages. All/open/working-answer filters show real matching counts alongside the topic total. Search is explicit; page navigation retains the displayed query even if a new query is being typed. Clear/reset, refresh, failed-list retry and first-page recovery keep empty views understandable. A failed exact-question link retries that question, and cancelled or superseded reads cannot reopen a view. Contributions, attachments and external pages are outside this title/context search. It changes no records and calls no external source or model.

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
Open-web discovery now uses federated indexes and Jev/Laya query–source decisions,
with explicit source inspection and link exploration. Reviewed multilingual query
bundles broaden discovery and retain exact per-source query provenance; see README
for limits and evaluation. Semantic private-corpus indexing and recurring query discovery remain
separate cycles. Production activation requires exact release receipts.

## Public collective discussion

Public dossiers support 20-item contribution pages, anonymous reading and native sign-in from the same page. Contributors deliberately enter a public display name and review their text and source links before posting. Authors can revise or remove their own contributions; dossier workspace administrators can hide/restore with a reason and inspect the private change history. Hidden text never appears in anonymous results, and an author edit cannot undo moderation. Personal public participation is available to current members, including viewers, without granting private workspace write access. Publication changes require a fresh read before posting. Withdrawal closes public reads and writes; account erasure removes that account's contributions.

## Success measures to validate with users

The outcome to measure is **important questions with a reviewed, source-backed answer that remains current**. Proposed pilot measures, not claimed results:

- Time from a question to the first useful primary source and working answer.
- Share of monitored topics with reviewed evidence, a named owner and a next review.
- Relevant versus irrelevant developments reported by the team; missed sources reported during review.
- Share of open questions resolved with a source-backed answer and later revisited when evidence changes.
- Repeated weekly use by more than one contributor and fewer duplicate research questions.

No adoption, time-saving, accuracy or clinical/legal validation numbers are invented. A professional pilot should decide whether the product improves real work before adding packaging or price claims.

## Next product gates

After observing real use: tune source retrieval and notifications; add demand-led provider coverage with explicit rights/readiness; evaluate semantic retrieval on a labelled private benchmark; consider a contributor role and followed-question digests. Public publication now has explicit author consent and a dedicated reader. Public discussion and reasoned moderation are now available. Personal following and reviewed private reuse are available. Scheduled search
rediscovery and followed-question digests remain subsequent slices. These are future gates, not shipped claims.

## Design references

Professional forums contribute focused threads and revisable accepted answers, as documented by [Discourse Solved](https://meta.discourse.org/t/discourse-solved/30155?tl=en). Research monitoring draws on [PubMed saved-search workflows](https://pubmed.ncbi.nlm.nih.gov/help/). The shipped literature lookup uses the [Europe PMC REST API](https://europepmc.org/RestfulWebService); official Swiss metadata discovery uses [Fedlex](https://fedlex.data.admin.ch/). These references informed the product model; integrations and coverage are limited to the implemented contracts above.
