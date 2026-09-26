# HelveticLens Pharma — product model

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
- **Monitoring / evidence:** saved native events, match explanations and validity, page-watch results, original sources and collection coverage.
- **Actions & reviews:** medicine/programme/market/lifecycle context, responsibility, priority, next review and outcomes.
- **Review desk:** paginated team or personal queue; overdue work, unassigned actions and due reviews are calculated from persisted records.
- **Topic brief:** private printable snapshot of questions, working answers, citations, unknowns, actions, decisions and references. JSON export includes structured questions, replies, actions and their research origins; attachments remain separate downloads.

## Trust and actual boundaries

The sites are public; working content is private by organization and product. Drafts remain private to their author. No existing workspace is made into a public forum. Team invitations reuse platform permissions. Collaboration is not cross-organization publishing.

Fedlex discovery matches catalogue titles, including their source language; Europe PMC discovery returns literature records. Both are explicit live searches capped at 20 records. Team search matches all entered words across each record’s name/title, content or topic subject; Exact phrase restricts matching to a complete phrase in one field. All-words mode accepts up to 12 distinct words. Both modes treat wildcard characters literally. Results favor title matches within each group and expose actual visible matching totals, returning up to 20 topics, 20 questions and 20 contributions; refine the terms if more matches exist. Neither an empty result nor an AI answer establishes complete coverage.

AI search planning receives only the explicitly entered question and product name; it does not fetch sources or read dossier context. The plan is a temporary draft in the current search view, restricted to the three supported providers and their actual search capabilities. It is not a saved monitoring configuration. AI research notes receive the configured, bounded topic evidence through the existing organization model provider. It does not autonomously browse the internet. Up to 18 selected snapshots are shown with the note; exact quotation checks establish attribution, not the truth or completeness of a claim. Files are not automatically parsed. Saved source records become watches only through an explicit connection action. Watches follow individual URLs, not entire websites or standing Europe PMC search queries.

Email remains the existing verified, consented personal organization digest, configured during setup. Forum replies and due tasks do not create a separate email subscription. Monitoring pauses, source collection and page-watch switches retain their distinct native behavior. Current UI language is English.

Limits: 500 questions per topic, 1,000 contributions per question, 1,000 actions per dossier; paginated histories. The printable brief includes the latest 50 questions, 100 actions, 20 notes/reviews and 100 references. Monitoring input snapshots and draft answers are historical records and can need review.

## Success measures to validate with users

The outcome to measure is **important questions with a reviewed, source-backed answer that remains current**. Proposed pilot measures, not claimed results:

- Time from a question to the first useful primary source and working answer.
- Share of monitored topics with reviewed evidence, a named owner and a next review.
- Relevant versus irrelevant developments reported by the team; missed sources reported during review.
- Share of open questions resolved with a source-backed answer and later revisited when evidence changes.
- Repeated weekly use by more than one contributor and fewer duplicate research questions.

No adoption, time-saving, accuracy or clinical/legal validation numbers are invented. A professional pilot should decide whether the product improves real work before adding packaging or price claims.

## Next product gates

After observing real use: tune source retrieval and notifications; add demand-led provider coverage with explicit rights/readiness; evaluate semantic retrieval on a labelled private benchmark; consider a contributor role and followed-question digests. Public professional communities require a deliberate visibility/moderation design and separate consent. These are future gates, not shipped claims.

## Design references

Professional forums contribute focused threads and revisable accepted answers, as documented by [Discourse Solved](https://meta.discourse.org/t/discourse-solved/30155?tl=en). Research monitoring draws on [PubMed saved-search workflows](https://pubmed.ncbi.nlm.nih.gov/help/). The shipped literature lookup uses the [Europe PMC REST API](https://europepmc.org/RestfulWebService); official Swiss metadata discovery uses [Fedlex](https://fedlex.data.admin.ch/). These references informed the product model; integrations and coverage are limited to the implemented contracts above.
