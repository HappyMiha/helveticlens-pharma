import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, BookOpen, Check } from 'lucide-react';
import { product } from '@/lib/product';
import './guide.css';

export const metadata: Metadata = {
  title: `Product guide | HelveticLens ${product.name}`,
  description: `Create a monitored topic, inspect sources and develop a shared working answer with HelveticLens ${product.name}.`,
  alternates: { canonical: `https://${product.domain}/guide` },
};

const chapters = [
  ['interface', 'Ask, read and trace evidence'],
  ['public-research', 'Develop a living public dossier'],
  ['ongoing-research', 'Keep research current automatically'],
  ['changes-over-time', 'Compare evidence over time'],
  ['start', 'Frame a useful question'],
  ['investigate', 'Ask this dossier'],
  ['contributions', 'Add material for private analysis'],
  ['discover', 'Find and keep sources'],
  ['monitor', 'Connect monitoring'],
  ['team-access', 'Invite your dossier team'],
  ['collaborate', 'Develop it together'],
  ['evidence', 'Review an AI research note'],
  ['review', 'Keep the answer current'],
  ['act', 'Turn understanding into action'],
  ['recover', 'When something needs attention'],
];

export default function Guide() {
  return (
    <div className="guide-shell">
      <header className="guide-header">
        <Link className="guide-brand" href="/">
          HelveticLens <span>{product.name}</span>
        </Link>
        <Link href="/">
          <ArrowLeft size={16} /> Open workspace
        </Link>
      </header>
      <main id="guide-content">
        <section className="guide-hero" aria-labelledby="guide-title">
          <span className="guide-eyebrow">
            <BookOpen size={16} /> PRODUCT GUIDE
          </span>
          <h1 id="guide-title">From a question to a shared, current answer.</h1>
          <p>
            {product.id === 'pharma'
              ? 'Keep medicine, safety and regulatory decisions connected to the evidence your team can inspect.'
              : 'Keep client matters, legal developments and follow-up decisions connected to the sources your team can inspect.'}
          </p>
          <div className="guide-summary">
            <Check size={18} />
            <span>
              A topic holds the question, sources, discussion, working answer
              and next action in one private workspace.
            </span>
          </div>
        </section>
        <div className="guide-layout">
          <nav aria-label="In this guide" className="guide-contents">
            <b>YOUR WORKING LOOP</b>
            <ol>
              {chapters.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`}>{label}</a>
                </li>
              ))}
            </ol>
            <Link href="/">
              Start a monitored topic <ArrowUpRight size={15} />
            </Link>
          </nav>
          <div className="guide-chapters">
            <section
              id="ongoing-research"
              aria-labelledby="ongoing-research-title"
            >
              <span className="guide-step">ONGOING RESEARCH</span>
              <h2 id="ongoing-research-title">
                Let new monitoring signals update the evidence.
              </h2>
              <p>
                In an active dossier, open Keep this dossier current. A dossier
                editor with workspace monitoring permission can enable private
                analysis of future saved topic matches. The permission continues
                while that person is signed out, and stops if their access or
                monitoring settings change.
              </p>
              <p>
                Choose one to six research starts per UTC day; the default is
                three. Each start uses one saved event-metadata excerpt and at
                most two model requests: extraction and comparison with earlier
                private findings. Explicit retries count toward the daily limit.
                Duplicate signal delivery starts no extra research, and
                interrupted paid requests are not repeated automatically.
              </p>
              <p>
                New signals wait if research is already active or the daily
                limit has been reached. The feed is checked about once a minute.
                Inspect each signal’s source, settings revision and
                investigation, then read Changes over time for paired
                quotations. A matching event is not automatically a material
                change, and event metadata is not the full document.
              </p>
              <p>
                Turn the mode off at any time. Changing settings cancels pending
                work under the previous settings; completed evidence remains
                inspectable. This mode performs no external discovery, makes no
                public contribution and adds no email subscription. Existing
                source admission, exclusions, dossier permissions and personal
                notification choices still apply. Automatic watched-page
                research and recurring open-web discovery are separate
                capabilities still to come.
              </p>
            </section>
            <section
              id="changes-over-time"
              aria-labelledby="changes-over-time-title"
            >
              <span className="guide-step">EVIDENCE HISTORY</span>
              <h2 id="changes-over-time-title">See what changed, and why.</h2>
              <p>
                Changes over time connects a newer finding to earlier evidence
                in the same dossier. It can corroborate a claim, contradict it,
                or describe a later state. Read the two original statements and
                exact supporting quotations side by side, then open either
                investigation for its full sources and original material.
              </p>
              <p>
                The original claim, status and history remain intact. Later
                evidence is shown separately. A machine-suggested relationship
                can be wrong; corroboration does not prove that sources are
                independent. Current dossier owners and editors can dismiss or
                restore a comparison with an explanation. Include dismissed
                comparisons to inspect the review history.
              </p>
              <p>
                Public comparisons can be read without registration. Public
                review notes require explicit publication confirmation.
                Withdrawing a contribution, publication or source removes its
                links from the current public view. Private material never
                enters public comparisons.
              </p>
              <p>
                Each completed analysis may compare up to 24 new and 24 earlier
                source-supported claims, using one retained supporting quotation
                per claim. This bounded step does not establish exhaustive
                coverage. Retry unavailable steps explicitly; completed
                comparisons are retained. Automated reopening from monitoring
                alerts is not yet available.
              </p>
            </section>
            <section
              id="public-research"
              aria-labelledby="public-research-title"
            >
              <span className="guide-step">PUBLIC RESEARCH</span>
              <h2 id="public-research-title">
                Develop a dossier together, in public.
              </h2>
              <p>
                The owner can enable living public research in the Public
                version preview. Existing publications remain snapshots until
                the owner explicitly chooses this mode. Anyone can read the
                published text, findings, sources and activity without an
                account.
              </p>
              <p>
                With a verified account, use Ask / Investigate or submit a
                comment, URL, correction or original file under your chosen
                public name. Confirm public analysis before publishing. Only an
                explicitly submitted research question and entity names found in
                public sources may enter external search; private dossier
                material is excluded.
              </p>
              <p>
                Public originals support TXT, Markdown, CSV, HTML and text PDF
                up to 2 MB. Findings retain quotes, source hashes, uncertainty
                and history. A submitted statement is candidate evidence, not an
                established fact. Scanned-image OCR and authenticated archives
                are unavailable.
              </p>
              <p>
                Search public dossiers, claims, entities, sources and research
                questions from Ask / Search or the public directory. Links to a
                claim or source open its investigation. Research progress
                updates automatically. Authors and current dossier editors can
                pause, resume, cancel or retry unavailable steps.
              </p>
              <p>
                Hiding or removing a contribution, withdrawing a publication or
                excluding a source removes affected research from public readers
                and search. Publishing an edited version starts a fresh public
                research revision; old derived findings are retained privately.
                Public copies or downloads made earlier cannot be recalled.
              </p>
              <Link href="/public-dossiers">Explore public dossiers</Link>
            </section>
            <section id="interface" aria-labelledby="interface-title">
              <span className="guide-step">THE WORKSPACE</span>
              <h2 id="interface-title">Ask, read and trace evidence.</h2>
              <p>
                The floating Ask / Search control is available on every page.
                Press Cmd/Ctrl + K, type your question, then choose where to
                look. Typing alone does not search. Public dossiers are
                available without an account; workspace search uses only
                material your current account may read.
              </p>
              <p>
                Inside a dossier, choose Investigate this dossier to start
                durable research. Public web search and investigation send the
                entered question to external search providers. Keep confidential
                details in workspace search. Source tools retain saved searches,
                multilingual drafting and detailed provider comparisons.
              </p>
              <p>
                Large counts describe the selected investigation’s captured
                sources, evidence-linked claims and contested claims. They do
                not measure total internet coverage. A source shows its origin,
                capture time, retained excerpts and the claims that use it.
                Unknown source classification and publication dates stay
                unknown.
              </p>
              <p>
                The Lens appears only during a recorded search, read or
                extraction step. Paused, finished and stale activity has no
                moving Lens. Text describes the same state, including when
                reduced motion is enabled. Open How was this produced? to
                inspect recorded actions, plan history and coverage limits.
              </p>
              <p>
                Use the theme control to cycle between system preference, light
                and dark. This preference stays on this device. On smaller
                screens, use the navigation drawer and open a source in its
                full-screen reader.
              </p>
            </section>
            <section id="start" aria-labelledby="start-title">
              <span className="guide-step">01 / INTENT</span>
              <h2 id="start-title">Frame a useful question.</h2>
              <p>
                Choose the decision your team needs to revisit, the subject, the
                place and the changes that would matter. Give each topic a
                focused goal. Broader work can develop through several questions
                inside that topic.
              </p>
              <blockquote>
                <b>An example for {product.name}</b>
                <p>{product.examples[0].goal}</p>
              </blockquote>
              <p>
                In <strong>Actions &amp; reviews</strong>, add your{' '}
                {product.id === 'pharma'
                  ? 'medicine or active substance, programme, markets and lifecycle stage'
                  : 'client or organisation, matter reference, jurisdictions and practice area'}
                . Name the next review date and responsible person.
              </p>
            </section>
            <section id="investigate" aria-labelledby="investigate-title">
              <span className="guide-step">LIVING RESEARCH</span>
              <h2 id="investigate-title">Ask this dossier.</h2>
              <p>
                Open a dossier, enter a question and choose{' '}
                <strong>Investigate</strong>. The system selects available
                sources, reads permitted excerpts and records claims with exact
                source quotes. New entities found in public evidence can open
                another research branch. The plan history shows the triggering
                source and why the plan changed.
              </p>
              <p>
                The submitted question and newly found public entity names go to
                public search. Keep confidential details out of that field.
                Existing saved dossier evidence can be analysed by the
                configured workspace AI; its contents are never added to
                external search queries.
              </p>
              <p>
                Research continues in the native job queue and saves each
                checkpoint. Pause, resume or cancel from the dossier.
                Interrupted requests are recorded without automatically
                repeating paid work. A source or model failure remains visible
                while other branches can finish.
              </p>
              <p>
                <strong>Supported</strong> means a source supports the
                statement, not that it has been independently established.{' '}
                <strong>Contested</strong>
                preserves both supporting and contradicting evidence. Inspect
                the quotes, source captures and claim history before relying on
                a finding. Entity mentions do not resolve identity from a
                matching name.
              </p>
              <p>
                Each investigation is bounded to three public branches, three
                inspected sources per branch and three saved evidence snapshots.
                Authenticated archives, scanned-image OCR and original file
                extraction are not available in this workflow yet. Existing
                public publication and monitoring controls stay in{' '}
                <strong>Discussion, monitoring &amp; dossier tools</strong>.
              </p>
            </section>
            <section id="contributions" aria-labelledby="contributions-title">
              <span className="guide-step">PRIVATE CONTRIBUTIONS</span>
              <h2 id="contributions-title">Add material. Keep its original.</h2>
              <p>
                Use Develop this dossier together to add a comment, source URL,
                correction, research request or file. Add &amp; analyse saves
                the original and authorship, then queues a private review. Open
                review to follow real progress, inspect exact quotes or download
                the original. Later contributions wait for current dossier work.
              </p>
              <p>
                The workspace AI analyses the submitted material. A submitted
                URL may be opened anonymously, using existing source
                restrictions. Private text is never used for public web
                searches. Nothing is published automatically. Use Ask explicitly
                for public discovery.
              </p>
              <p>
                Files up to 10 MB are retained. Automatic extraction accepts
                TXT, Markdown, CSV, HTML and text PDF up to 2 MB. PDF reading is
                limited to documents of at most 60 pages, the first 20 pages and
                24,000 extracted characters. Images, Office files, scanned or
                encrypted PDFs remain downloadable with an explicit unavailable
                result. Research requests and corrections can also inspect two
                saved evidence snapshots; they do not automatically rewrite
                other reviews.
              </p>
              <p>
                Retry unavailable steps preserves completed work and the
                original. Pause, resume and cancel apply to the review. If a
                save response is lost, retry the unchanged form to recover the
                same contribution. Legacy attachment and note tools remain
                save-only.
              </p>
            </section>
            <section id="discover" aria-labelledby="discover-title">
              <span className="guide-step">02 / DISCOVERY</span>
              <h2 id="discover-title">Find and keep sources.</h2>
              <p>
                Choose <strong>Public web</strong> to investigate a public
                question beyond the source catalogue. Quick, Broad and Deep
                select up to 8, 24 or 36 sources. Confirm which queries may
                leave your workspace. Auto uses Jev with local Laya fallback;
                Compare evaluates the same candidates with both available
                engines.
              </p>
              <p>
                Open <strong>Broaden the search</strong> for two alternative
                queries using other terms or languages. You can ask AI to draft
                suggestions in English, German, French, Italian or Ukrainian.
                Review the suggestions, apply them to the editable fields, then
                confirm and run the search. Results share one source limit and
                are assessed against your main question. Each source records the
                exact queries that found it, including after import.
              </p>
              <p>
                Every query uses one daily query unit; a bundle uses one to
                three. A failed retrieval lane stays visible, and manual
                alternatives remain available if AI drafting fails.
              </p>
              <p>
                Review the original links, then mark relevance to measure
                quality on your own sample. Open{' '}
                <strong>Read public source</strong> for extracted passages and
                links to investigate next. Your saved search keeps the result
                without repeating retrieval. Import sources into a dossier
                within 30 minutes, or start reviewed monitoring setup. Search
                snippets and model confidence do not establish truth.
              </p>
              <p>
                Start with team knowledge. Workspace discovery searches visible
                topics, questions and contributions; the source library helps
                retrieve older saved references. Inside a topic, question search
                matches all entered words across titles and context, with
                filters for open questions and working answers.
              </p>
              <p>
                Use <strong>Find sources</strong> for explicit Fedlex
                official-title or Europe PMC literature searches. An AI search
                plan can suggest editable phrases and supported providers.
                Choosing a suggestion prepares a search; pressing Search sends
                that phrase to the selected provider. Remove confidential names
                and matter details from external queries.
              </p>
              <p>
                Inspect the original record before saving it. Imported
                references retain the catalogue record, query, page and
                retrieval time. Use <strong>Saved searches</strong> to keep an
                attributed query and purpose for the team to review and run
                again.
              </p>
              <aside>
                Catalogue metadata helps locate a source. Read the original
                document before relying on its contents. Saved searches run when
                a person explicitly opens and submits them.
              </aside>
            </section>
            <section id="monitor" aria-labelledby="monitor-title">
              <span className="guide-step">03 / MONITORING</span>
              <h2 id="monitor-title">Connect monitoring.</h2>
              <p>
                Use the five-step setup to describe the goal, review AI topic
                suggestions, choose available source collections, preview saved
                evidence and choose delivery before activation. Draft monitoring
                stays private to its author or invited dossier team. At
                activation, choose team-only monitoring or explicitly share it
                with the workspace.
              </p>
              <p>
                In <strong>Evidence &amp; sources</strong>, a saved reference in
                a workspace-visible dossier can become a watch of that specific
                page when collection is supported. Review the last attempt, last
                successful check, saved-version time, failures and schedule.
                Pause, retry or enable daily checks explicitly where the
                controls are available.
              </p>
              <aside>
                The displayed catalogue defines scheduled coverage. A country
                name in your goal does not add a data feed. A page watch checks
                its URL; an index page can omit documents, and dynamic or
                inaccessible pages can fail visibly.
              </aside>
            </section>
            <section id="team-access" aria-labelledby="team-access-title">
              <span className="guide-kicker">Dossier team</span>
              <h2 id="team-access-title">
                Invite the right people to the evidence.
              </h2>
              <p>
                Open a saved research draft or active dossier and expand Dossier
                team. The original creator can enable team management, then
                invite a workspace colleague or a guest by their verified email
                address as an editor, contributor or viewer. Guests must already
                have an account. The invitation appears in the colleague’s
                Dossier invitations and expires after seven days. It is tied to
                that account; a copied link grants nobody else access. No email
                is sent.
              </p>
              <p>
                Owners manage people and publication. Editors edit the dossier
                and control research. Contributors add comments, URLs, files,
                corrections and research requests, and analyse their own
                contributions. Viewers can read and download retained evidence.
                An owner can promote an accepted colleague to owner before
                reducing their own role.
              </p>
              <p>
                Invited team drafts are private to their accepted members. At
                activation, choose Only my invited team to keep monitoring
                private, or explicitly confirm sharing with everyone in the
                workspace. Private topics, matches, research and digest previews
                follow current membership. Removing a role closes future access,
                including retained digest history in the product. In a workspace
                dossier, inherited workspace access remains. Existing dossiers
                keep their audience. Accepted guests find the dossier in Shared
                with you without joining its workspace or changing their own
                workspace. Guest access includes sources, original files,
                research and exports. Ownership, publication, monitoring setup
                and source administration remain with the host workspace. Guest
                feeds and email preferences stay in their own workspace.
              </p>
              <p>
                Revoke a pending invitation or change an accepted member’s role
                in Dossier team. Server checks apply to saved sources, exports,
                native setup and every research step. Removing private access
                closes future reads and analysis; it cannot erase a copy someone
                already downloaded or an email already delivered.
              </p>
              <aside className="guide-boundary">
                Members-only monitoring uses the selected approved source feeds.
                New page watches use the shared workspace library, so they are
                unavailable inside a private dossier; submitted URLs remain
                private research references. Shared AI briefs use workspace
                interests only. Use Ask / Investigate for research that includes
                your private evidence. Monitoring activation still requires
                workspace administrator rights and fixes the audience for that
                monitor. Public publication remains a separate, explicit owner
                action.
              </aside>
            </section>
            <section id="collaborate" aria-labelledby="collaborate-title">
              <span className="guide-step">04 / COLLABORATION</span>
              <h2 id="collaborate-title">Develop it together.</h2>
              <p>
                In <strong>Questions &amp; discussion</strong>, find an existing
                question or open a focused one with enough context for a useful
                answer. Add attributed contributions, supporting URLs,
                disagreements and unresolved gaps. Keep background notes and
                files in their dedicated tabs.
              </p>
              <p>
                Workspace administrators can contribute, manage monitoring and
                accept answers. Viewers can read. Use{' '}
                <strong>Team &amp; access</strong> for invitations and roles.
                Sharing a question or source link preserves its exact
                destination; recipients still need workspace access.
              </p>
              <aside>
                Question and reply text being composed is local to the open view
                until submitted. Monitoring setup drafts are saved on the
                platform. Downloaded attachments stay separate from AI research
                inputs.
              </aside>
            </section>
            <section id="evidence" aria-labelledby="evidence-title">
              <span className="guide-step">05 / EVIDENCE</span>
              <h2 id="evidence-title">Review an AI research note.</h2>
              <p>
                To share your findings with everyone, open the dossier’s{' '}
                <strong>Public version</strong> tab. Write a separate public
                title, summary, text and source links, preview the exact version
                and confirm publication. Read published versions at{' '}
                <Link href="/public-dossiers">Public dossiers</Link> without an
                account. Changes need a new preview; withdrawing removes the
                public version here. Private files and discussions stay in the
                workspace. Published dossiers also have a public discussion.
                Sign in here to add a contribution, choose a public display
                name, attach source links and review the preview before
                confirming. You can edit or remove your own contributions.
                Dossier administrators can hide or restore a contribution with a
                reason; an edit to a hidden contribution stays hidden until
                reviewed. Withdrawing the dossier closes its public discussion.
              </p>
              <p>
                Use <strong>Follow dossier</strong> to keep publication and
                public discussion changes in your personal{' '}
                <Link href="/following">Followed dossiers</Link> list. Refresh
                to check updates and explicitly mark an update as seen.
                Following is private to your account and sends no email. Hidden
                contributions do not generate visible update signals. Withdrawn
                text is unavailable; deleted publications leave the list.
              </p>
              <p>
                Workspace administrators can choose{' '}
                <strong>Create a private working copy</strong>
                on a public reader. Set your own question, preview the exact
                public text and links, and confirm. The result is an
                author-private draft with its original attribution and revision,
                visible throughout setup and in the working dossier. Complete
                setup to activate monitoring; choose delivery explicitly. The
                saved snapshot stays with your dossier if the original changes
                or is withdrawn. Public discussion, private material and linked
                document files are not copied.
              </p>
              <p>
                Review saved-source decisions with a reason: include a URL for
                new AI research, exclude it or return it to unreviewed. Source
                decisions retain an attributed history. Unreviewed does not mean
                excluded; inspect <strong>Review AI inputs</strong> before
                generating a note.
              </p>
              <p>
                The preview shows the bounded material selected for the
                question. Generate only after reviewing it. New material or
                changed evidence can require a refreshed preview. A saved note
                retains its source snapshots, exact quoted passages, findings,
                open gaps and suggested next searches.
              </p>
              <p>
                Use <strong>Read saved document</strong> on page citations to
                inspect the recorded source and evidence revision, with capture
                time and coverage. Older notes may have an unknown original
                revision; the reader labels that limitation. Exact quotes
                support traceability, while relevance, completeness and
                professional interpretation require your review.
              </p>
            </section>
            <section id="review" aria-labelledby="review-title">
              <span className="guide-step">06 / A WORKING ANSWER</span>
              <h2 id="review-title">Keep the answer current.</h2>
              <p>
                A person accepts a contribution or AI note as the working
                answer. Reopen the question when that answer no longer serves
                the team. New saved material, corrected page evidence or lost
                source access can produce a specific review warning.
              </p>
              <p>
                Read the warning and the affected evidence. Use{' '}
                <strong>Refresh review</strong> to obtain the current state,
                then <strong>Reconfirm after review</strong> only when you have
                assessed it. If evidence changes before confirmation, refresh
                and inspect it again. The original research note and its quotes
                remain part of the history.
              </p>
              <aside>
                Reconfirmation records a human acknowledgement of the saved
                evidence and known limitations. It does not establish that every
                relevant external development has been discovered.
              </aside>
            </section>
            <section id="act" aria-labelledby="act-title">
              <span className="guide-step">07 / FOLLOW-THROUGH</span>
              <h2 id="act-title">Turn understanding into action.</h2>
              <p>
                Create follow-up from a question or a specific AI evidence gap.
                Review its text, assign responsibility and a deadline, then
                record the outcome. The action keeps a link to the original
                question or gap. Use the <strong>Review desk</strong> for your
                own or the team’s due work.
              </p>
              <p>
                In <strong>Improve monitoring</strong>, record relevance
                feedback and review a proposed change before applying it. The
                platform records a new monitoring revision. A private printable
                topic brief and JSON export bring together the topic’s evidence,
                discussion, decisions and follow-up.
              </p>
              <p>
                In-app evidence appears inside the workspace. Email preferences
                use the existing daily or weekly personal organisation digest,
                subject to verified email, consent and delivery readiness. They
                do not create a separate instant alert channel for every
                dossier.
              </p>
            </section>
            <section id="recover" aria-labelledby="recover-title">
              <span className="guide-step">WHEN YOU NEED A WAY FORWARD</span>
              <h2 id="recover-title">When something needs attention.</h2>
              <dl className="guide-recovery">
                <div>
                  <dt>No search matches</dt>
                  <dd>
                    Use fewer words, try the source language or clear the
                    answer/source-review filter. Counts describe the selected
                    scope. A zero result does not establish that no relevant
                    information exists elsewhere.
                  </dd>
                </div>
                <div>
                  <dt>A page watch failed</dt>
                  <dd>
                    Read its current failure and last successful check. Open the
                    original source, retry where available or choose a source
                    the collector can read. Retained evidence can be older than
                    the latest attempt.
                  </dd>
                </div>
                <div>
                  <dt>A saved document changed</dt>
                  <dd>
                    Return to the first page and explicitly reload the current
                    revision. This keeps text from different revisions from
                    being silently mixed. The saved AI quote stays unchanged.
                  </dd>
                </div>
                <div>
                  <dt>A source or question cannot be opened</dt>
                  <dd>
                    Retry that record and check the current workspace and role.
                    A private draft belongs to its author. Removed access stays
                    unavailable even when an older note retains an excerpt.
                  </dd>
                </div>
                <div>
                  <dt>An edit conflicts with a teammate</dt>
                  <dd>
                    Refresh the current state, compare it with your intended
                    change and submit a reviewed update. Repeatedly submitting
                    an old revision cannot overwrite the newer decision.
                  </dd>
                </div>
                <div>
                  <dt>An AI step is unavailable</dt>
                  <dd>
                    Keep working with manual questions, saved sources and team
                    contributions. Try the AI step again when the configured
                    service is available; an error is not a generated answer.
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </main>
      <footer className="guide-footer">
        <p>
          HelveticLens {product.name} · Public product guide · Private working
          content
        </p>
        <a
          href={`https://github.com/HappyMiha/helveticlens-${product.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Apache-2.0 source <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
