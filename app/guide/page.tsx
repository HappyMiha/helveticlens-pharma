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
  ['start', 'Frame a useful question'],
  ['discover', 'Find and keep sources'],
  ['monitor', 'Connect monitoring'],
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
            <section id="discover" aria-labelledby="discover-title">
              <span className="guide-step">02 / DISCOVERY</span>
              <h2 id="discover-title">Find and keep sources.</h2>
              <p>
                Choose <strong>Open web · Jev + Laya</strong> to investigate a
                public question beyond the source catalogue. Quick, Broad and
                Deep select up to 8, 24 or 36 sources. Confirm which query may
                leave your workspace. Auto uses Jev with local Laya fallback;
                Compare evaluates the same candidates with both available
                engines.
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
                stays private to its author. Activating shares the topic inside
                the current organisation.
              </p>
              <p>
                In <strong>Evidence &amp; sources</strong>, a saved reference
                can become a watch of that specific page when collection is
                supported. Review the last attempt, last successful check,
                saved-version time, failures and schedule. Pause, retry or
                enable daily checks explicitly where the controls are available.
              </p>
              <aside>
                The displayed catalogue defines scheduled coverage. A country
                name in your goal does not add a data feed. A page watch checks
                its URL; an index page can omit documents, and dynamic or
                inaccessible pages can fail visibly.
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
