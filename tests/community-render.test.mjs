import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Exercise actual server rendering without a browser or live account. Type
// checking remains the separate full-project gate; this loader only transpiles.
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename;
const originalTs = Module._extensions['.ts'];
const originalTsx = Module._extensions['.tsx'];
const originalCss = Module._extensions['.css'];
Module._extensions['.css'] = () => {}; // Server markup assertions do not load styles.
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(
    this,
    ['next/link', 'next/navigation'].includes(name)
      ? resolve('node_modules/vinext/dist/shims/' + name.slice(5) + '.js')
      : name.startsWith('@/')
        ? resolve(name.slice(2))
        : name,
    ...args,
  );
};
for (const extension of ['.ts', '.tsx'])
  Module._extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
const { PublicDiscussion } = require(
  resolve('components/public-discussion.tsx'),
);
const { contributionDraft } = require(resolve('lib/community.ts'));
const { PublicCopyOrigin, PublicSnapshot } = require(
  resolve('components/public-origin.tsx'),
);
const { reuseDraft, reuseCommand } = require(
  resolve('lib/public-following.ts'),
);
const { PublicDossierActions, FollowedDossiers } = require(
  resolve('components/public-following.tsx'),
);
after(() => {
  Module._resolveFilename = originalResolve;
  if (originalCss) Module._extensions['.css'] = originalCss;
  else delete Module._extensions['.css'];
  if (originalTs) Module._extensions['.ts'] = originalTs;
  else delete Module._extensions['.ts'];
  if (originalTsx) Module._extensions['.tsx'] = originalTsx;
  else delete Module._extensions['.tsx'];
});

const base = {
  publicationId: '11111111-1111-1111-1111-111111111111',
  publicationRevision: 1,
};
const page = {
  items: [],
  total: 0,
  offset: 0,
  page_size: 20,
  publication_revision: 1,
  can_post: false,
  can_moderate: false,
};

test('anonymous SSR contains the discussion and honest empty state without account controls', () => {
  const html = renderToStaticMarkup(
    React.createElement(PublicDiscussion, { ...base, initial: page }),
  );
  assert.match(html, /Public discussion/);
  assert.match(html, /No public contributions yet/);
  assert.doesNotMatch(
    html,
    /Edit my contribution|Remove my contribution|Hide from discussion|Signed in as/,
  );
});

test('anonymous SSR escapes contributed text and keeps source links isolated', () => {
  const item = {
    id: '22222222-2222-2222-2222-222222222222',
    revision: 1,
    publication_revision: 1,
    author_label: '<script>author()</script>',
    body: '<img src=x onerror=alert(1)>',
    sources: [
      {
        title: '<script>source()</script>',
        url: 'https://www.fedlex.admin.ch/',
      },
    ],
    created_at: '2026-09-27T00:00:00Z',
    updated_at: '2026-09-27T00:00:00Z',
  };
  const html = renderToStaticMarkup(
    React.createElement(PublicDiscussion, {
      ...base,
      initial: { ...page, items: [item], total: 1 },
    }),
  );
  assert.match(html, /&lt;script&gt;author/);
  assert.match(html, /&lt;img src=x/);
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /rel="noopener noreferrer nofollow ugc"/);
  assert.match(html, /target="_blank"/);
});

test('new contributions never infer a public name or copy hidden account metadata', () => {
  assert.deepEqual(contributionDraft(), {
    author_label: '',
    body: '',
    sources: [],
  });
  const draft = contributionDraft({
    author_label: 'Chosen public name',
    body: 'Public text',
    sources: [
      {
        title: 'Source',
        url: 'https://www.fedlex.admin.ch/',
        secret: 'PRIVATE',
      },
    ],
    email: 'PRIVATE',
    moderation_reason: 'PRIVATE',
    organization_id: 'PRIVATE',
  });
  assert.equal(JSON.stringify(draft).includes('PRIVATE'), false);
});

const published = {
  id: base.publicationId,
  product: 'pharma',
  revision: 4,
  title: 'A published research topic',
  summary: 'An explicitly published question and summary.',
  author_label: '<script>person()</script>',
  body: '<img src=x onerror=alert(1)>',
  sources: [
    { title: 'Original <source>', url: 'https://www.fedlex.admin.ch/' },
  ],
  first_published_at: '2026-09-27T00:00:00Z',
  updated_at: '2026-09-27T00:00:00Z',
};
test('private snapshot keeps full text, attribution, revision and safe source links', () => {
  const html = renderToStaticMarkup(
    React.createElement(PublicCopyOrigin, {
      origin: {
        snapshot: published,
        snapshot_sha256: 'a'.repeat(64),
        copied_at: published.updated_at,
        source_url:
          'https://pharma.helveticlens.ch/public-dossiers/' + published.id,
      },
    }),
  );
  assert.match(html, /revision 4/);
  assert.match(html, /&lt;script&gt;person/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /noopener noreferrer nofollow ugc/);
  assert.match(html, /Open original public dossier/);
  assert.match(html, /a{64}/);
  assert.doesNotMatch(html, /<script>|<img src=x/);
  const long = renderToStaticMarkup(
    React.createElement(PublicSnapshot, {
      snapshot: { ...published, body: 'x'.repeat(29990) + 'END-OF-COPY' },
    }),
  );
  assert.match(long, /x{29990}END-OF-COPY/);
});
test('copy preview uses only deliberate setup fields and retains retry identity', () => {
  const draft = reuseDraft({
    ...published,
    organization_id: 'PRIVATE',
    email: 'PRIVATE',
    title: 'x'.repeat(240),
  });
  assert.equal(draft.name.length, 160);
  assert.deepEqual(Object.keys(draft).sort(), [
    'expected_revision',
    'goal',
    'name',
  ]);
  const preview = {
    draft,
    snapshot: { secret: 'PRIVATE' },
    preview_token: 'b'.repeat(64),
    preview_expires_at: '2026-09-27T01:00:00Z',
    internal: 'PRIVATE',
  };
  const command = reuseCommand(preview, base.publicationId, false);
  assert.equal(command.confirm_private_copy, false);
  assert.equal(command.request_key, base.publicationId);
  assert.deepEqual(reuseCommand(preview, base.publicationId, false), command);
  assert.equal(JSON.stringify(command).includes('PRIVATE'), false);
  assert.equal('source_pack_ids' in command, false);
});
test('public personal surfaces wait for native identity without rendering private records', () => {
  const actions = renderToStaticMarkup(
    React.createElement(PublicDossierActions, { dossier: published }),
  );
  assert.match(actions, /Checking sign-in/);
  assert.match(actions, /Following sends no email/);
  assert.doesNotMatch(
    actions,
    /Create private draft|Stop following|Signed in as/,
  );
  const list = renderToStaticMarkup(React.createElement(FollowedDossiers));
  assert.match(list, /Checking sign-in/);
  assert.doesNotMatch(list, /No followed dossiers yet|New public changes/);
});

const { SearchComparison, DecisionDiscovery } = require(
  resolve('components/decision-search.tsx'),
);
test('comparison renders measured zero accuracy, unknown cost and unlabelled accuracy distinctly', () => {
  const metric = {
    engine: 'laya',
    models: ['<unsafe-model>'],
    error: null,
    latency_ms: 100,
    input_tokens: null,
    output_tokens: null,
    estimated_cost_usd: null,
    mean_selected_probability: 0.8,
    mean_confidence: 0.6,
    evaluation: {
      accuracy: 0,
      labelled_count: 2,
      candidate_count: 8,
      brier_score: 0.7,
      basis: 'User labels only.',
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(SearchComparison, {
      result: {
        selected_engine: 'laya',
        engines: [
          metric,
          {
            ...metric,
            engine: 'jev',
            models: [],
            error: 'not_configured',
            evaluation: {
              ...metric.evaluation,
              accuracy: null,
              labelled_count: 0,
            },
          },
        ],
      },
    }),
  );
  assert.match(html, /0\.0% · 2\/8 reviewed/);
  assert.match(html, /Not measured · 0\/8 reviewed/);
  assert.match(html, /Unknown/);
  assert.match(html, /Connection needed/);
  assert.match(html, /&lt;unsafe-model&gt;/);
  assert.doesNotMatch(html, /<unsafe-model>/);
  assert.match(html, /Local compute cost/);
  assert.match(html, /Labels stay private/);
});
test('web search initially requires explicit disclosure, with no invented results or viewer write access', () => {
  const html = renderToStaticMarkup(
    React.createElement(DecisionDiscovery, {
      initialQuery: '<script>private</script>',
      canSearch: false,
    }),
  );
  assert.match(html, /Public web query/);
  assert.match(html, /No private dossier text is added/);
  assert.match(html, /workspace administrator can run web searches/);
  assert.match(html, /<button(?=[^>]*type="submit")(?=[^>]*disabled="")/);
  assert.doesNotMatch(html, /checked=""|Results for|<script>private/);
  assert.match(html, /up to 36 sources/);
});

const { QueryBundleFields } = require(resolve('components/query-bundle.tsx'));
const { SourceProvenance } = require(
  resolve('components/source-provenance.tsx'),
);
const bundleProps = {
  question: 'A public research question',
  alternatives: ['', ''],
  draft: null,
  disabled: false,
  planning: false,
  onChange() {},
  onPlan() {},
  onUse() {},
};
test('query draft starts with empty editable alternatives and requires deliberate disclosure', () => {
  const html = renderToStaticMarkup(
    React.createElement(QueryBundleFields, bundleProps),
  );
  assert.match(html, /Alternative query 1/);
  assert.match(html, /Alternative query 2/);
  assert.match(html, /daily query budget/);
  assert.match(
    html,
    /<button(?=[^>]*disabled="")(?=[^>]*type="button")[^>]*>Draft alternatives/,
  );
  assert.doesNotMatch(html, /checked=""|Use draft in editable fields/);
});
test('planner drafts render as escaped review text without replacing fields or applying a stale question', () => {
  const draft = {
    question: bundleProps.question,
    model: '<unsafe-model>',
    model_provider: 'test',
    searched: false,
    alternatives: [
      {
        language: 'de',
        query: '<script>Öffentliche Frage</script>',
        reason: '<img src=x>',
      },
    ],
  };
  const html = renderToStaticMarkup(
    React.createElement(QueryBundleFields, { ...bundleProps, draft }),
  );
  assert.match(html, /Review the suggested queries/);
  assert.match(html, /Use draft in editable fields/);
  assert.match(html, /&lt;script&gt;Öffentliche Frage/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /&lt;unsafe-model&gt;/);
  assert.match(html, /No sources have been searched/);
  assert.doesNotMatch(html, /<script>|<img src=x|value="&lt;script/);
  const stale = renderToStaticMarkup(
    React.createElement(QueryBundleFields, {
      ...bundleProps,
      question: 'A changed question',
      draft,
    }),
  );
  assert.doesNotMatch(stale, /Use draft in editable fields|Öffentliche Frage/);
});
test('saved source provenance escapes exact queries and supports records predating bundles', () => {
  const value = {
    query: 'Main question',
    retrieved_at: '2026-09-27T12:00:00Z',
    page_number: 1,
    record: {
      id: 'source',
      provider: 'Search1API',
      title: 'Source title',
      retrieval_queries: ['Arzneimittelsicherheit', '<script>query</script>'],
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(SourceProvenance, { value }),
  );
  assert.match(html, /Main question/);
  assert.match(html, /Retrieved by these exact queries/);
  assert.match(html, /Arzneimittelsicherheit/);
  assert.match(html, /&lt;script&gt;query/);
  assert.doesNotMatch(html, /<script>/);
  const legacy = renderToStaticMarkup(
    React.createElement(SourceProvenance, {
      value: {
        ...value,
        record: { ...value.record, retrieval_queries: undefined },
      },
    }),
  );
  assert.match(legacy, /Source title/);
  assert.doesNotMatch(legacy, /Retrieved by these exact queries/);
});

const { InvestigationFindings } = require(
  resolve('components/investigation-findings.tsx'),
);
const { DossierInvestigation } = require(
  resolve('components/investigation.tsx'),
);
const { sourceHref } = require(resolve('lib/investigation.ts'));

test('living research shows evidence, contested history and escaped source text', () => {
  const value = {
    evidence_basis: 'Source support is not independent verification.',
    claims: [
      {
        id: 'claim-one',
        statement: '<script>claim()</script>',
        status: 'CONTESTED',
        revision: 2,
        history: [
          {
            revision: 1,
            from: 'UNVERIFIED',
            to: 'SUPPORTED',
            at: '2026-09-27T12:00:00Z',
            basis: 'Source evidence',
          },
          {
            revision: 2,
            from: 'SUPPORTED',
            to: 'CONTESTED',
            at: '2026-09-27T12:00:00Z',
            basis: 'Contradicting source',
          },
        ],
      },
    ],
    evidence: [
      {
        id: 'evidence-one',
        claim_id: 'claim-one',
        source_id: 'source-one',
        quote: '<img src=x onerror=alert(1)>',
        locator: 'p1',
        relation: 'CONTRADICTS',
      },
    ],
    sources: [
      {
        id: 'source-one',
        kind: 'public_source',
        title: 'Original source',
        url: 'https://example.org/record',
        sha256: 'a'.repeat(64),
        created_at: '2026-09-27T12:00:00Z',
        snapshot: {
          scope: 'Bounded source excerpt',
          excerpts: [{ text: '<img src=x onerror=alert(1)>', passage: 'p1' }],
        },
      },
    ],
    entities: [],
    relationships: [],
  };
  const html = renderToStaticMarkup(
    React.createElement(InvestigationFindings, { value }),
  );
  assert.match(html, /Contested/);
  assert.match(html, /Contradicts/);
  assert.match(html, /Claim history/);
  assert.match(html, /Supported → Contested/);
  assert.match(html, /href="#source-source-one"/);
  assert.match(html, /id="claim-claim-one"/);
  assert.match(html, /SHA-256/);
  assert.match(html, /&lt;script&gt;claim/);
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /rel="noopener noreferrer nofollow ugc"/);
});

test('the primary dossier form discloses external search and exposes no engine controls', () => {
  const html = renderToStaticMarkup(
    React.createElement(DossierInvestigation, {
      dossierId: 'test',
      canEdit: true,
    }),
  );
  assert.match(html, /Ask this dossier/);
  assert.match(html, /Investigate sends this question/);
  assert.match(html, /Keep confidential details out of this field/);
  assert.doesNotMatch(html, /Choose.*engine|Agent count|Select model/);
  const viewer = renderToStaticMarkup(
    React.createElement(DossierInvestigation, {
      dossierId: 'test',
      canEdit: false,
    }),
  );
  assert.match(viewer, /owner or editor/);
  assert.match(viewer, /disabled/);
});

test('evidence source links reject active content and credential URLs', () => {
  assert.equal(sourceHref('javascript:alert(1)'), null);
  assert.equal(sourceHref('https://user:secret@example.org'), null);
  assert.equal(sourceHref('http://example.org'), null);
  assert.equal(
    sourceHref('https://example.org/evidence'),
    'https://example.org/evidence',
  );
});

const { investigationActivity, evidenceCounts, sourceUsage } = require(
  resolve('lib/lens.ts'),
);
const { LensProgress } = require(resolve('components/lens.tsx'));
const { UniversalAskSearch } = require(
  resolve('components/universal-ask-search.tsx'),
);
const { SourceMetadata } = require(resolve('components/source-card.tsx'));
const { TransparencyPanel } = require(
  resolve('components/transparency-panel.tsx'),
);
const now = Date.parse('2026-09-27T15:00:30Z');
function activityFixture(phase = 'read', status = 'running') {
  return {
    status,
    stop_reason: '',
    branches: [
      {
        query: 'Public question',
        status: 'running',
        phase,
        steps: [
          {
            id: 'step',
            phase,
            status: 'running',
            started_at: '2026-09-27T15:00:00Z',
          },
        ],
      },
    ],
  };
}
test('Lens uses the recorded in-flight step and never fabricates an analysis stage', () => {
  assert.equal(investigationActivity(activityFixture(), now).state, 'reading');
  assert.equal(
    investigationActivity(activityFixture('compare'), now).state,
    'cross-referencing',
  );
  assert.equal(
    investigationActivity(activityFixture('compare'), now + 100_000).state,
    'idle',
  );
  assert.equal(
    investigationActivity(activityFixture('extract'), now).state,
    'extracting',
  );
  assert.equal(
    investigationActivity(activityFixture('search'), now).state,
    'searching',
  );
  assert.equal(
    investigationActivity(activityFixture('future-stage'), now).state,
    'idle',
  );
  for (const status of ['queued', 'paused', 'cancelled', 'failed'])
    assert.equal(
      investigationActivity(activityFixture('read', status), now).state,
      'idle',
    );
  assert.equal(
    investigationActivity(activityFixture('read', 'completed'), now).state,
    'complete',
  );
});
test('stale, missing and future checkpoint timestamps cannot keep Lens animation active', () => {
  assert.equal(
    investigationActivity(activityFixture(), now + 100_000).state,
    'idle',
  );
  assert.equal(
    investigationActivity(activityFixture(), now - 50_000).state,
    'idle',
  );
  const v = activityFixture();
  delete v.branches[0].steps[0].started_at;
  assert.equal(investigationActivity(v, now).state, 'idle');
  v.branches[0].steps = [];
  assert.equal(investigationActivity(v, now).state, 'idle');
});
test('Lens always has an accessible text state and has no optical element when idle or complete', () => {
  for (const state of ['idle', 'complete']) {
    const html = renderToStaticMarkup(
      React.createElement(LensProgress, {
        activity: { state, label: 'Saved state', detail: 'Source text' },
      }),
    );
    assert.match(html, /<output aria-live="polite">Saved state/);
    assert.doesNotMatch(html, /class="lens-overlay"|class="lens-optic"/);
  }
  const reading = renderToStaticMarkup(
    React.createElement(LensProgress, {
      activity: {
        state: 'reading',
        label: 'Reading source material',
        detail: '<script>source</script>',
      },
    }),
  );
  assert.match(reading, /data-lens-state="reading" aria-hidden="true"/);
  assert.match(reading, /&lt;script&gt;source/);
});
test('evidence metrics count stored records and source usage deduplicates multiple quotes', () => {
  const v = {
    sources: [{ id: 's' }],
    claims: [
      { id: 'a', status: 'CONTESTED' },
      { id: 'b', status: 'SUPPORTED' },
    ],
    branches: [{ status: 'failed' }],
    evidence: [
      { source_id: 's', claim_id: 'a', relation: 'SUPPORTS' },
      { source_id: 's', claim_id: 'a', relation: 'CONTRADICTS' },
      { source_id: 's', claim_id: 'a', relation: 'CONTRADICTS' },
      { source_id: 'other', claim_id: 'b', relation: 'SUPPORTS' },
    ],
  };
  assert.deepEqual(evidenceCounts(v), {
    sources: 1,
    claims: 2,
    contested: 1,
    unfinished: 1,
  });
  assert.deepEqual(sourceUsage(v, 's'), { claims: ['a'], contradictions: 1 });
});
test('source metadata does not infer primary status or publication date from a capture', () => {
  const html = renderToStaticMarkup(
    React.createElement(SourceMetadata, {
      source: {
        url: 'https://example.org/document',
        created_at: '2026-09-27T15:00:00Z',
      },
    }),
  );
  assert.match(html, /example.org/);
  assert.match(html, /Primary \/ secondary not established/);
  assert.match(html, /Publication date<\/dt><dd>Not established/);
});
test('global Ask is present without a session and typing does not start a server-rendered search', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      UniversalAskSearch,
      null,
      React.createElement('main', null, 'Research'),
    ),
  );
  assert.match(html, /Ask Helvetic Lens or search anything/);
  assert.match(html, /Ctrl K/);
  assert.doesNotMatch(
    html,
    /Search results|lens-optic|New investigation|private query/,
  );
});
test('transparency counts only completed actions and retains unavailable steps and coverage', () => {
  const html = renderToStaticMarkup(
    React.createElement(TransparencyPanel, {
      value: {
        branches: [
          {
            steps: [
              { phase: 'read', status: 'completed' },
              { phase: 'read', status: 'interrupted' },
              { phase: 'extract', status: 'running' },
            ],
          },
        ],
        sources: [{ id: 's' }],
        plans: [],
        activity: [],
        plan_version: 1,
        evidence_basis: 'Exact quotes are not independent verification.',
        coverage: 'Bounded accessible sources.',
      },
    }),
  );
  assert.match(html, /How was this produced/);
  assert.match(
    html,
    /Source retrieval · 1 completed · 1 unavailable or interrupted/,
  );
  assert.match(html, /Claim and entity extraction · 0 completed/);
  assert.match(html, /Bounded accessible sources/);
  assert.doesNotMatch(html, /100%|7 sources|independently verified/);
});

test('contribution composer discloses private analysis and requires explicit submission', () => {
  const {
    DossierContributions,
  } = require('../components/dossier-contributions.tsx');
  const html = renderToStaticMarkup(
    React.createElement(DossierContributions, {
      dossierId: '11111111-1111-4111-8111-111111111111',
      entries: [],
      canEdit: true,
      onOpen: () => {
        throw new Error('Rendering must not open research');
      },
      onSaved: () => {
        throw new Error('Rendering must not submit research');
      },
    }),
  );
  assert.match(html, /Add &amp; analyse/);
  assert.match(html, /private text is never used for public web searches/);
  assert.match(html, /Nothing is published automatically/);
  assert.match(html, /Source URL/);
  assert.match(html, /Correction/);
  assert.match(html, /Research request/);
});

test('read-only dossier contribution surface does not expose write controls', () => {
  const {
    DossierContributions,
  } = require('../components/dossier-contributions.tsx');
  const html = renderToStaticMarkup(
    React.createElement(DossierContributions, {
      dossierId: '11111111-1111-4111-8111-111111111111',
      entries: [],
      canEdit: false,
      onOpen() {},
      async onSaved() {},
    }),
  );
  assert.doesNotMatch(html, /<form|<textarea|type="submit"/);
  assert.match(html, /owner, editor or contributor/);
});

test('original contributions preserve literal text, authorship and scoped download URLs', () => {
  const {
    OriginalContribution,
  } = require('../components/dossier-contributions.tsx');
  const original = {
    id: '22222222-2222-4222-8222-222222222222',
    kind: 'file',
    title: '<script>source</script>',
    body: 'Original  spaces\n<script>untrusted</script>',
    url: '',
    byte_size: 123,
    sha256: 'a'.repeat(64),
    author: 'Original author',
    created_at: '2026-09-27T12:00:00Z',
  };
  const render = (dossierId) =>
    renderToStaticMarkup(
      React.createElement(OriginalContribution, { original, dossierId }),
    );
  const html = render('11111111-1111-4111-8111-111111111111');
  assert.match(html, /Original author/);
  assert.match(html, /Original  spaces\n&lt;script&gt;untrusted/);
  assert.match(html, /Original SHA-256/);
  assert.match(
    html,
    /\/dossiers\/11111111-1111-4111-8111-111111111111\/files\/22222222-2222-4222-8222-222222222222/,
  );
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(render('../another-dossier'), /href=/);
});

test('dossier audiences distinguish invited drafts, private monitoring and shared monitoring', () => {
  const { TeamAudience, TeamRoles } = require('../components/dossier-team.tsx');
  const { audienceDescription } = require('../lib/dossier-team.ts');
  const privateDraft = renderToStaticMarkup(
    React.createElement(TeamAudience, {
      access: { audience: 'invited_team', role: 'CONTRIBUTOR' },
    }),
  );
  assert.match(privateDraft, /Only the accepted dossier team/);
  assert.match(privateDraft, /choose team-only monitoring/);
  assert.match(privateDraft, /Contributor/);
  const activePrivate = renderToStaticMarkup(
    React.createElement(TeamAudience, {
      access: { audience: 'team', role: 'VIEWER' },
    }),
  );
  assert.match(activePrivate, /Only accepted dossier members/);
  assert.match(activePrivate, /Removing a role removes future access/);
  assert.doesNotMatch(
    activePrivate,
    /Everyone in this workspace|shares.*workspace/,
  );
  assert.match(audienceDescription('workspace'), /Everyone in this workspace/);
  assert.match(
    audienceDescription('workspace'),
    /unless assigned a different dossier role/,
  );
  const roles = renderToStaticMarkup(React.createElement(TeamRoles));
  for (const label of ['Owner', 'Editor', 'Contributor', 'Viewer'])
    assert.match(roles, new RegExp(label));
  assert.match(roles, /analyse those contributions/);
});

test('closed team panel never renders an editable roster or invitation form before access is loaded', () => {
  const { DossierTeamPanel } = require('../components/dossier-team.tsx');
  const html = renderToStaticMarkup(
    React.createElement(DossierTeamPanel, {
      dossierId: '11111111-1111-4111-8111-111111111111',
      access: { audience: 'invited_team', role: 'VIEWER', can_manage: false },
      async onChanged() {},
      onLeave() {},
    }),
  );
  assert.match(html, /Dossier team/);
  assert.match(html, /Viewer/);
  assert.doesNotMatch(html, /<form|<select|Make owner|Create invitation/);
});

test('activation review defaults to private monitoring and preserves existing workspace audience', () => {
  const { Wizard } = require('../components/wizard.tsx');
  const { emptyConfig } = require('../components/workspace.tsx');
  const render = (audience, status = 'draft', privateReady = true) =>
    renderToStaticMarkup(
      React.createElement(Wizard, {
        initial: {
          id: '11111111-1111-4111-8111-111111111111',
          profile: {
            id: 'p',
            status,
            step: 4,
            revision: 1,
            config: emptyConfig(),
          },
          access: {
            audience,
            can_activate: true,
            ...(privateReady ? { can_watch_pages: false } : {}),
          },
        },
        packs: [],
        identity: {
          role: 'organization_admin',
          user: { email_verified: true },
        },
        emailAvailable: false,
        busy: '',
      }),
    );
  const draft = render('author');
  assert.match(draft, /Only my invited team/);
  assert.match(draft, /Research references/);
  assert.match(draft, /workspace page watches are unavailable in this mode/);
  assert.match(
    draft,
    /publishing a public snapshot is a separate owner action/,
  );
  assert.doesNotMatch(
    draft,
    /id="share-dossier-workspace"|Page watches to connect/,
  );
  assert.doesNotMatch(draft, /Private monitoring needs a platform update/);
  const legacy = render('author', 'draft', false);
  assert.match(legacy, /Private monitoring needs a platform update/);
  assert.match(legacy, /<button[^>]*disabled=""[^>]*>Start monitoring/);
  const shared = render('workspace', 'active');
  assert.match(shared, /id="share-dossier-workspace"/);
  assert.match(shared, /Page watches to connect/);
  assert.match(
    shared,
    /Make this dossier and its monitoring visible to everyone/,
  );
  assert.match(
    shared,
    /<[^>]+(?=[^>]*aria-label="Monitoring audience")(?=[^>]*data-disabled)[^>]*>/,
  );
});

test('living public reader renders attributed evidence and anchors without private controls', () => {
  const { PublicResearchView } = require('../components/public-research.tsx');
  const run = {
    id: '11111111-1111-4111-8111-111111111111',
    question: 'Research a public question',
    status: 'completed',
    revision: 4,
    plan_version: 1,
    event_sequence: 3,
    stop_reason: 'Bounded accessible research.',
    sources: [],
    evidence: [],
    entities: [],
    relationships: [],
    plans: [],
    branches: [],
    activity: [],
    claims: [
      {
        id: 'public-claim',
        statement: '<script>untrusted source statement</script>',
        status: 'UNVERIFIED',
        revision: 1,
        history: [],
      },
    ],
    evidence_basis: 'Source support is not independent truth.',
    coverage: 'Only explicitly public material.',
    original: {
      id: 'public-contribution',
      kind: 'comment',
      body: 'The exact public submission.',
      author: 'Chosen public name',
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(PublicResearchView, {
      publicationId: '22222222-2222-4222-8222-222222222222',
      revision: 1,
      initial: {
        items: [run],
        total: 1,
        offset: 0,
        page_size: 20,
        publication_revision: 1,
        living_research: true,
      },
      selectedId: run.id,
      initialValue: run,
    }),
  );
  assert.match(html, /Chosen public name/);
  assert.match(html, /Source support is not independent truth/);
  assert.match(html, /id="claim-public-claim"/);
  assert.match(html, /&lt;script&gt;untrusted source statement/);
  assert.match(html, /Sign in to add a public question/);
  assert.doesNotMatch(
    html,
    /<form|<script>|\/dossiers\/|>Pause<|>Resume<|>Cancel</,
  );
});

test('changed public publication revision withholds old rendered findings', () => {
  const { PublicResearchView } = require('../components/public-research.tsx');
  const html = renderToStaticMarkup(
    React.createElement(PublicResearchView, {
      publicationId: '22222222-2222-4222-8222-222222222222',
      revision: 2,
      initial: {
        items: [],
        total: 0,
        offset: 0,
        page_size: 20,
        publication_revision: 3,
        living_research: true,
      },
      selectedId: 'old',
      initialValue: { id: 'old', question: 'WITHDRAWN-PUBLIC-TEXT' },
    }),
  );
  assert.match(html, /published version changed/);
  assert.doesNotMatch(html, /WITHDRAWN-PUBLIC-TEXT/);
});

const {
  ClaimEvolution,
  EvidenceChangeCard,
} = require('../components/claim-evolution.tsx');
const { currentChanges } = require('../lib/claim-evolution.ts');
const previousFinding = {
  id: 'previous-claim',
  investigation_id: 'previous-run',
  statement: '<script>Earlier statement</script>',
  status: 'SUPPORTED',
  revision: 2,
  evidence: {
    quote: '<img src=x onerror=alert(1)> Exact older quotation.',
    locator: 'p2',
    relation: 'SUPPORTS',
    source: {
      id: 'source-old',
      title: 'Earlier registry',
      kind: 'public_source',
      url: 'https://example.org/earlier',
      sha256: 'a'.repeat(64),
      captured_at: '2026-09-27T12:00:00Z',
    },
  },
};
const evolution = {
  id: 'change',
  kind: 'UPDATES',
  status: 'active',
  revision: 1,
  previous_revision: 2,
  previous_status: 'SUPPORTED',
  created_at: '2026-09-27T15:00:00Z',
  updated_at: '2026-09-27T15:00:00Z',
  explanation: 'The newer source describes a later state.',
  basis: 'Machine comparison, not independent verification.',
  previous: previousFinding,
  current: {
    ...previousFinding,
    id: 'newer-claim',
    investigation_id: 'newer-run',
    statement: 'A later statement.',
    evidence: {
      ...previousFinding.evidence,
      quote: 'Exact newer quotation.',
      source: {
        ...previousFinding.evidence.source,
        url: 'javascript:alert(1)',
        title: 'Newer source',
      },
    },
  },
  history: [],
};
const changesPage = {
  items: [evolution],
  total: 24,
  offset: 0,
  page_size: 20,
  publication_revision: 1,
  coverage: 'Bounded evidence, not completeness.',
  can_review: true,
};

test('anonymous comparison SSR renders both originals and safe quotes, without editor controls', () => {
  const html = renderToStaticMarkup(
    React.createElement(ClaimEvolution, {
      base: '/products/pharma/public-dossiers/public/evidence-changes',
      publicationRevision: 1,
      initial: changesPage,
      onOpen() {},
      onChange() {},
    }),
  );
  assert.match(html, /Changes over time/);
  assert.match(html, /Earlier finding/);
  assert.match(html, /Newer finding/);
  assert.match(html, /&lt;script&gt;Earlier statement/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /Exact newer quotation/);
  assert.match(html, /Recorded status: Supported/);
  assert.match(html, /noopener noreferrer nofollow ugc/);
  assert.match(html, /Older comparisons/);
  assert.doesNotMatch(
    html,
    /<form|Dismiss comparison|javascript:|<script>|<img/,
  );
});

test('comparison snapshots never survive a failed read, changed publication or unrelated page', () => {
  assert.equal(
    currentChanges(null, 'Access changed', changesPage, 0, false, 1),
    null,
  );
  assert.equal(currentChanges(changesPage, '', null, 0, false, 2), null);
  assert.equal(currentChanges(null, '', changesPage, 20, false, 1), null);
  assert.equal(currentChanges(null, '', changesPage, 0, true, 1), null);
  assert.equal(currentChanges(changesPage, '', null, 0, false), null);
  assert.equal(currentChanges(null, '', changesPage, 0, false, 1), changesPage);
  assert.equal(
    currentChanges(
      { ...changesPage, publication_revision: null },
      '',
      null,
      0,
      false,
    )?.total,
    24,
  );
});

test('changed public comparison revision renders no withdrawn source text or stale count', () => {
  const html = renderToStaticMarkup(
    React.createElement(ClaimEvolution, {
      base: '/public/evidence-changes',
      publicationRevision: 2,
      initial: changesPage,
      onOpen() {},
      onChange() {},
    }),
  );
  assert.match(html, /Checking current evidence/);
  assert.doesNotMatch(
    html,
    /Earlier statement|Exact newer quotation|24 active/,
  );
});

test('review history preserves an editor decision without presenting a dismissed relation as active', () => {
  const html = renderToStaticMarkup(
    React.createElement(EvidenceChangeCard, {
      value: {
        ...evolution,
        status: 'dismissed',
        revision: 2,
        history: [
          {
            revision: 2,
            from: 'active',
            to: 'dismissed',
            reason: '<script>Different subjects</script>',
            at: '2026-09-27T16:00:00Z',
          },
        ],
      },
      onOpen() {},
    }),
  );
  assert.match(html, /Dismissed · revision 2/);
  assert.match(html, /Editor review history/);
  assert.match(html, /&lt;script&gt;Different subjects/);
  assert.match(html, /Earlier statement/);
  assert.doesNotMatch(html, /<script>/);
});

test('later evidence status is separate from the original supported claim and its history', () => {
  const {
    InvestigationFindings,
  } = require('../components/investigation-findings.tsx');
  const html = renderToStaticMarkup(
    React.createElement(InvestigationFindings, {
      value: {
        sources: [],
        evidence: [],
        entities: [],
        relationships: [],
        evidence_basis: 'Source-linked evidence',
        claims: [
          {
            id: 'old',
            statement: 'Recorded finding.',
            status: 'SUPPORTED',
            revision: 1,
            history: [
              {
                revision: 1,
                from: 'UNVERIFIED',
                to: 'SUPPORTED',
                at: '2026-09-27T12:00:00Z',
                basis: 'Exact quotation',
              },
            ],
            later_evidence: {
              status: 'CONTESTED',
              changes: [{ kind: 'CONTRADICTS', count: 1 }],
            },
          },
        ],
      },
    }),
  );
  assert.match(html, /data-status="SUPPORTED"/);
  assert.match(html, /Later evidence: Contested/);
  assert.match(html, /Contradicts \(1\)/);
  assert.match(html, /href="#evidence-changes"/);
  assert.match(html, /Exact quotation/);
});

const {
  MonitoringPolicyStatus,
  MonitoringPolicyForm,
  MonitoringTriggerRow,
} = require(resolve('components/monitoring-research.tsx'));
const { currentMonitoring } = require(resolve('lib/monitoring-research.ts'));
const monitoringPolicy = {
  enabled: false,
  revision: 0,
  daily_limit: 3,
  used_today: 0,
  starts_on: null,
  checked_at: null,
  reason: 'Automatic research is off.',
  disclosure: 'Private saved metadata only; no external discovery.',
  include_page_changes: false,
  page_disclosure: 'Also analyse a bounded retained page excerpt.',
  page_readiness: {
    allowed: true,
    linked: 1,
    active: 1,
    reason: 'One linked daily watch.',
  },
  history: [],
};

test('monitoring research settings disclose standing scope and do not pre-consent', () => {
  const html = renderToStaticMarkup(
    React.createElement(MonitoringPolicyForm, {
      base: '/products/pharma/dossiers/example/monitoring-research',
      policy: monitoringPolicy,
      onSaved() {},
    }),
  );
  assert.match(html, /while I am signed out/);
  assert.match(html, /Maximum research starts per UTC day/);
  assert.match(html, /Explicit retries also count/);
  assert.match(html, /pending work from the previous settings/);
  assert.match(html, /type="submit"[^>]*disabled/);
  assert.doesNotMatch(html, /aria-checked="true"/);
});

test('monitoring status only reports saved checks and actual capacity', () => {
  const html = renderToStaticMarkup(
    React.createElement(MonitoringPolicyStatus, { policy: monitoringPolicy }),
  );
  assert.match(html, /Automatic research off/);
  assert.match(html, /0 of 3 starts used today/);
  assert.match(html, /Not checked yet/);
  assert.match(html, /candidate signal/);
  assert.doesNotMatch(html, /lens-overlay|Live coverage|Evidence verified/);
});

test('monitoring trigger preserves escaped source cause and investigation links', () => {
  const item = {
    id: 'trigger-1',
    match_id: 'match-1',
    evaluation_fingerprint: 'e'.repeat(64),
    policy_revision: 2,
    matched_at: '2026-09-27T20:00:00Z',
    state: 'started',
    reason: 'Saved signal initiated research.',
    source: {
      title: '<script>bad()</script>',
      url: 'javascript:alert(1)',
      sha256: 'a'.repeat(64),
    },
    investigation: {
      id: 'run-1',
      status: 'completed',
      stop_reason: 'Bounded research complete.',
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(MonitoringTriggerRow, { item, onOpen() {} }),
  );
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Open investigation/);
  assert.match(html, /href="#evidence-changes"/);
  assert.match(html, /Settings revision 2/);
  assert.match(html, /saved event metadata/);
  assert.doesNotMatch(html, /href="javascript:|<script>/);
});

test('monitoring history is cleared on access errors and dossier changes', () => {
  const value = { dossier_id: 'mine', policy: monitoringPolicy, items: [] };
  assert.equal(currentMonitoring(value, '', 'mine'), value);
  assert.equal(currentMonitoring(value, 'Access changed', 'mine'), null);
  assert.equal(currentMonitoring(value, '', 'other'), null);
  assert.equal(currentMonitoring(null, '', 'mine'), null);
});

test('page research scope stays opt-in and explains members-only readiness', () => {
  const normal = renderToStaticMarkup(
    React.createElement(MonitoringPolicyForm, {
      base: '/private',
      policy: monitoringPolicy,
      onSaved() {},
    }),
  );
  assert.match(normal, /Include changes to saved source pages/);
  assert.doesNotMatch(normal, /aria-checked="true"/);
  const unavailable = renderToStaticMarkup(
    React.createElement(MonitoringPolicyForm, {
      base: '/private',
      policy: {
        ...monitoringPolicy,
        page_readiness: {
          allowed: false,
          linked: 0,
          active: 0,
          reason:
            'Workspace page watches are unavailable in members-only dossiers.',
        },
      },
      onSaved() {},
    }),
  );
  assert.match(unavailable, /members-only dossiers/);
  assert.match(
    unavailable,
    /role="checkbox"[^>]*disabled|disabled[^>]*role="checkbox"/,
  );
});

test('saved page changes show escaped paired excerpts and exact retained-version actions', () => {
  const item = {
    id: 'page-trigger',
    source_kind: 'watched_page',
    source_identifier: 'watch:version',
    source_revision: '2',
    policy_revision: 3,
    matched_at: '2026-09-28T00:00:00Z',
    state: 'started',
    reason: 'A retained version changed.',
    source: {
      title: 'Original page',
      url: 'https://example.ch/source',
      sha256: 'a'.repeat(64),
    },
    investigation: { id: 'run', status: 'completed' },
    page: {
      document_id: 'law',
      version_id: 'new',
      revision: 2,
      previous: { version_id: 'old', revision: 1 },
      first_difference: 300,
      excerpt_start: 120,
      before: '<script>old</script>',
      after: 'New captured text',
      partial: true,
      preview_partial: false,
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(MonitoringTriggerRow, {
      item,
      dossierId: 'dossier',
      onOpen() {},
    }),
  );
  assert.match(html, /Saved page change/);
  assert.match(html, /Inspect the saved change/);
  assert.match(html, /Read earlier version/);
  assert.match(html, /Read new version/);
  assert.match(html, /character 301/);
  assert.match(html, /more changes may appear elsewhere/);
  assert.match(html, /&lt;script&gt;old/);
  assert.doesNotMatch(html, /<script>|signal matched the dossier/);
});

const { WebPolicyForm, WebPolicyStatus, WebTriggerRow } = require(
  resolve('components/web-research.tsx'),
);
const { currentWebResearch } = require(resolve('lib/web-research.ts'));
const { MonitoringOutcomeReader } = require(
  resolve('components/monitoring-outcome.tsx'),
);

const monitoringFinding = (id, text) => ({
  id,
  investigation_id: `run-${id}`,
  statement: text,
  status: 'SUPPORTED',
  revision: 1,
  evidence: {
    quote: `<script>${text}</script>`,
    locator: 'p1',
    relation: 'SUPPORTS',
    source: {
      id: `source-${id}`,
      title: 'Captured registry',
      url: 'https://example.org',
      sha256: 'f'.repeat(64),
    },
  },
});
const monitoringResult = {
  contract: 'monitoring-outcome/v1',
  state: 'completed',
  finding_state: 'changes',
  limitations: [],
  scope: 'Only the saved question and captured sources.',
  findings: [monitoringFinding('new', 'Later source finding')],
  comparisons: [
    {
      id: 'change',
      kind: 'UPDATES',
      explanation: 'A proposed later state.',
      previous: monitoringFinding('old', 'Earlier source finding'),
      current: monitoringFinding('new', 'Later source finding'),
    },
  ],
};

test('monitoring result connects earlier and later quotations without repeating the finding', () => {
  const html = renderToStaticMarkup(
    React.createElement(MonitoringOutcomeReader, {
      outcome: monitoringResult,
      onOpen() {},
    }),
  );
  assert.match(html, /Evidence to compare/);
  assert.match(html, /AI comparison/);
  assert.match(html, /Earlier evidence/);
  assert.match(html, /Later evidence/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|AI finding/);
  assert.equal((html.match(/<details/g) || []).length, 1);
  assert.equal((html.match(/Open research record/g) || []).length, 2);
});

for (const [state, expected] of Object.entries({
  queued: 'Waiting to check',
  running: 'Checking the saved question',
  paused: 'Check paused',
  cancelled: 'Check stopped',
  unavailable: 'Evidence unavailable',
}))
  test(`monitoring ${state} cannot render a retained completed finding`, () => {
    const html = renderToStaticMarkup(
      React.createElement(MonitoringOutcomeReader, {
        outcome: { ...monitoringResult, state },
        onOpen() {},
      }),
    );
    assert.ok(html.includes(expected));
    assert.doesNotMatch(
      html,
      /Later source finding|Earlier source finding|<blockquote/,
    );
  });

for (const [finding_state, expected] of Object.entries({
  unchanged: 'Captured sources unchanged',
  no_matches: 'No sources returned',
  no_findings: 'No supported finding to show',
  findings: 'New findings to read',
}))
  test(`monitoring ${finding_state} explains what the check establishes`, () => {
    const html = renderToStaticMarkup(
      React.createElement(MonitoringOutcomeReader, {
        outcome: {
          ...monitoringResult,
          finding_state,
          findings: [],
          comparisons: [],
        },
        onOpen() {},
      }),
    );
    assert.ok(html.includes(expected));
    assert.doesNotMatch(html, /Nothing changed|Everything is current/);
  });

test('partial monitoring keeps its useful evidence beside a visible limitation', () => {
  const html = renderToStaticMarkup(
    React.createElement(MonitoringOutcomeReader, {
      outcome: {
        ...monitoringResult,
        state: 'partial',
        limitations: ['Source reading was not completed.'],
      },
      onOpen() {},
    }),
  );
  assert.match(html, /Check partly completed/);
  assert.match(html, /Source reading was not completed/);
  assert.match(html, /Later source finding/);
});

test('scheduled history uses the outcome and keeps measurements in details', () => {
  const html = renderToStaticMarkup(
    React.createElement(WebTriggerRow, {
      item: {
        id: 'trigger',
        question: 'Saved public question',
        policy_revision: 2,
        created_at: '2026-09-30T00:00:00Z',
        investigation: {
          id: 'run',
          status: 'completed',
          stop_reason: 'Technical stop text',
        },
        outcome: monitoringResult,
        analysed_sources: 1,
        unchanged_sources: 0,
        coverage: [{ engines: [], retrieval: null, latency_ms: null }],
      },
      onOpen() {},
    }),
  );
  assert.match(html, /Evidence to compare/);
  assert.doesNotMatch(html, /Technical stop text/);
  assert.ok(
    html.indexOf('Indexes, timing') < html.indexOf('1 sources analysed'),
  );
});
const webPolicy = {
  enabled: false,
  revision: 0,
  question: '',
  cadence_hours: 24,
  daily_limit: 2,
  used_today: 0,
  readiness: {
    configured: true,
    reason: 'Configuration present; live checks occur during execution.',
  },
  next_run_at: null,
  checked_at: null,
  reason: 'Recurring search is off.',
  disclosure: 'Only the explicitly public question is sent externally.',
  history: [],
};

test('recurring public query requires deliberate text, cadence and unchecked standing consent', () => {
  const html = renderToStaticMarkup(
    React.createElement(WebPolicyForm, {
      base: '/web-research',
      policy: webPolicy,
      onSaved() {},
    }),
  );
  assert.match(html, /Public search question/);
  assert.match(html, /Daily · every 24 hours/);
  assert.match(html, /Weekly · every 7 days/);
  assert.match(html, /while I am signed out/);
  assert.match(html, /type="submit"[^>]*disabled/);
  assert.doesNotMatch(html, /aria-checked="true"|Pause recurring search/);
});

test('recurring status and access guard hide stale data without inventing a check', () => {
  const html = renderToStaticMarkup(
    React.createElement(WebPolicyStatus, { policy: webPolicy }),
  );
  assert.match(html, /0 of 2 starts\/retries/);
  assert.match(html, /Not scheduled/);
  assert.match(html, /Not checked yet/);
  assert.doesNotMatch(html, /lens-overlay|Verified|100%/);
  const data = { dossier_id: 'one', policy: webPolicy };
  assert.equal(currentWebResearch(data, '', 'one'), data);
  assert.equal(currentWebResearch(data, 'Access revoked', 'one'), null);
  assert.equal(currentWebResearch(data, '', 'another'), null);
});

test('recurring results expose fallback, unchanged captures and unknown cost without accuracy claims', () => {
  const html = renderToStaticMarkup(
    React.createElement(WebTriggerRow, {
      onOpen() {},
      item: {
        id: 'trigger',
        question: '<script>untrusted()</script>',
        policy_revision: 1,
        created_at: '2026-09-28T00:00:00Z',
        investigation: {
          id: 'run',
          status: 'completed',
          stop_reason: 'Bounded check; unavailable steps remain visible.',
        },
        analysed_sources: 1,
        unchanged_sources: 2,
        coverage: [
          {
            selected_engine: 'laya',
            latency_ms: 123,
            error: null,
            retrieval: {
              lanes: [{ name: 'Bing web', status: 'unavailable', count: 0 }],
            },
            engines: [
              {
                engine: 'jev',
                latency_ms: 4,
                error: 'quota',
                estimated_cost_usd: null,
                mean_confidence: null,
              },
              {
                engine: 'laya',
                latency_ms: 50,
                estimated_cost_usd: null,
                mean_confidence: 0.91,
                cost_scope: 'Decision inference only.',
              },
            ],
          },
        ],
      },
    }),
  );
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /2 unchanged captures skipped/);
  assert.match(html, /Open search investigation/);
  assert.match(html, /Decision cost estimate: Unknown/);
  assert.match(html, /Independent accuracy: not evaluated/);
  assert.match(html, /0.910/);
  assert.doesNotMatch(html, /<script>|Accuracy: 91|\$0\.000000/);
});

const { EvidenceSearch, EvidenceSearchResults, EvidenceSearchResult } = require(
  resolve('components/evidence-search.tsx'),
);
const {
  currentEvidenceSearch,
  evidenceAnchor,
  completeEvidenceSearch,
} = require(resolve('lib/evidence-search.ts'));
const evidenceItem = {
  id: 'receipt',
  kind: 'claim',
  investigation_id: 'investigation',
  source_id: 'source',
  title: 'Untrusted <script>source</script>',
  url: 'javascript:alert(1)',
  sha256: 'a'.repeat(64),
  quote: '<img src=x onerror=alert(1)> exact retained quote',
  locator: 'p21',
  created_at: '2026-09-28T00:00:00Z',
  statement: 'A source-linked finding',
  claim_status: 'CONTESTED',
  claim_id: 'claim',
  claim_revision: 3,
  text_truncated: true,
  text_characters: 2800,
  semantic_match: true,
  literal_match: false,
  relevance_probability: 0.91,
  confidence: 0.82,
};
const evidencePage = {
  dossier_id: 'dossier',
  query: 'private question',
  mode: 'semantic',
  method: 'local_semantic_hybrid',
  items: [evidenceItem],
  total_records: 30,
  matching_records: null,
  examined_records: 12,
  offset: 0,
  batch_size: 12,
  next_offset: 12,
  as_of: '2026-09-28T00:00:00Z',
  fingerprint: 'b'.repeat(64),
  coverage: 'Only this saved evidence window.',
  measurement: {
    latency_ms: 234,
    requests_completed: 12,
    models: ['fixture'],
    estimated_cost_usd: null,
    accuracy: null,
    accuracy_basis: 'Not reviewed independently.',
    cost_scope: 'Local cost is unknown, not zero.',
    confidence_definition: 'Model confidence is not accuracy.',
  },
};
test('private evidence search SSR explains local scope and does not run a search', () => {
  const html = renderToStaticMarkup(
    React.createElement(EvidenceSearch, { dossierId: 'dossier', onOpen() {} }),
  );
  assert.match(html, /Find the evidence you already have/);
  assert.match(html, /Meaning · all saved evidence/);
  assert.match(html, /All words · no model/);
  assert.match(html, /12 records at a time/);
  assert.match(html, /Typing alone sends nothing/);
  assert.doesNotMatch(html, /fixture|private question|records in this batch/);
});
test('evidence results retain exact provenance, disputed status and safe source links', () => {
  const html = renderToStaticMarkup(
    React.createElement(EvidenceSearchResult, {
      item: evidenceItem,
      onOpen() {},
    }),
  );
  assert.match(html, /contested/i);
  assert.match(html, /revision 3/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /p21/);
  assert.match(html, /SHA-256/);
  assert.match(html, /Open finding &amp; citations/);
  assert.match(html, /First 2,400 of 2800/);
  assert.match(html, /not measured accuracy/);
  assert.doesNotMatch(html, /href="javascript:|<script>|<img /);
  assert.equal(evidenceAnchor(evidenceItem), 'claim-claim');
  assert.equal(
    evidenceAnchor({ ...evidenceItem, kind: 'passage' }),
    'source-source',
  );
});
test('bounded search makes older evidence, failure recovery and unknown measurements explicit', () => {
  const html = renderToStaticMarkup(
    React.createElement(EvidenceSearchResults, {
      page: { ...evidencePage, method: 'literal_fallback' },
      onOpen() {},
      onPage() {},
    }),
  );
  assert.match(html, /12 records in this batch/);
  assert.match(html, /30 saved records/);
  assert.match(html, /Search older evidence/);
  assert.match(html, /Local comparison was unavailable/);
  assert.match(html, /Cost: Unknown/);
  assert.match(html, /Independent accuracy: not evaluated/);
  assert.doesNotMatch(html, /Cost: 0|Accuracy: 91|Newer evidence/);
});
test('stale, cross-dossier, edited-query and failure evidence pages are never reused', () => {
  assert.equal(
    currentEvidenceSearch(
      evidencePage,
      'dossier',
      ' private question ',
      'semantic',
      '',
    ),
    evidencePage,
  );
  for (const args of [
    [null, 'dossier', 'private question', 'semantic', ''],
    [evidencePage, 'other', 'private question', 'semantic', ''],
    [evidencePage, 'dossier', 'another question', 'semantic', ''],
    [evidencePage, 'dossier', 'private question', 'literal', ''],
    [evidencePage, 'dossier', 'private question', 'semantic', 'Access revoked'],
  ])
    assert.equal(currentEvidenceSearch(...args), null);
});

test('model-negative evidence remains inspectable without implying a word match', () => {
  const html = renderToStaticMarkup(
    React.createElement(EvidenceSearchResult, {
      item: { ...evidenceItem, semantic_match: false, literal_match: false },
      onOpen() {},
    }),
  );
  assert.match(html, /remains visible for your review/);
  assert.doesNotMatch(html, /This record matched the search words/);
});

const { researchHref, researchFocus } = require(
  resolve('lib/research-following.ts'),
);
const { ResearchUpdateItem, FollowControls } = require(
  resolve('components/research-following.tsx'),
);
test('research notification links preserve exact private and public source context without query text', () => {
  const dossier = '11111111-1111-4111-8111-111111111111';
  const run = '22222222-2222-4222-8222-222222222222';
  const anchor = 'source-33333333-3333-4333-8333-333333333333';
  const privateUrl = new URL(
    researchHref('private', dossier, run, anchor),
    'https://example.test',
  );
  assert.deepEqual(researchFocus(privateUrl.search, dossier), {
    id: run,
    anchor,
    tick: 0,
  });
  assert.equal(researchFocus(privateUrl.search, 'another-dossier'), undefined);
  assert.equal(
    researchFocus('?dossier=' + dossier + '&research=untrusted-text', dossier),
    undefined,
  );
  const publicUrl = new URL(
    researchHref('public', dossier, run, anchor),
    'https://example.test',
  );
  assert.equal(publicUrl.pathname, '/public-dossiers/' + dossier);
  assert.equal(publicUrl.searchParams.get('research'), run);
  assert.equal(publicUrl.hash, '#' + anchor);
  assert.equal(publicUrl.searchParams.has('dossier'), false);
});
test('research update previews render literal escaped quotes and independent paired evidence', () => {
  const item = {
    investigation_id: 'new-run',
    question: '<script>unsafe</script>',
    completed_at: '2026-09-28T02:00:00Z',
    unseen: true,
    source_count: 2,
    finding_count: 1,
    comparison_counts: { CONTRADICTS: 1 },
    sources: [
      {
        id: 'new-source',
        title: 'Registry <unsafe>',
        quote: 'Literal <source> words',
        locator: 'p1',
        truncated: false,
      },
    ],
    findings: [
      {
        id: 'new-claim',
        statement: 'Machine <finding>',
        status: 'SUPPORTED',
        source_id: 'new-source',
      },
    ],
    comparisons: [
      {
        id: 'comparison',
        kind: 'CONTRADICTS',
        basis: 'Machine comparison, not independent verification.',
        previous: {
          id: 'old-claim',
          investigation_id: 'old-run',
          statement: 'Earlier finding',
          evidence: {
            quote: 'Earlier exact quote',
            locator: 'p2',
            source: { id: 'old-source', title: 'Previous registry' },
          },
        },
        current: {
          id: 'new-claim',
          investigation_id: 'new-run',
          statement: 'Later finding',
          evidence: {
            quote: 'Later exact quote',
            locator: 'p1',
            source: { id: 'new-source', title: 'Current registry' },
          },
        },
      },
    ],
    completion_note: 'One unavailable branch. Coverage is not exhaustive.',
  };
  const html = renderToStaticMarkup(
    React.createElement(ResearchUpdateItem, {
      item,
      audience: 'private',
      dossierId: 'doc',
    }),
  );
  assert.match(html, /Literal &lt;source&gt; words/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /possible contradictions/);
  assert.match(html, /Earlier exact quote/);
  assert.match(html, /Later exact quote/);
  assert.match(html, /research=old-run/);
  assert.match(html, /source-old-source/);
  assert.match(html, /not independent verification/);
  assert.match(html, /One unavailable branch/);
});
test('explicit seen control discloses reading versus verification and counts real unseen research', () => {
  const html = renderToStaticMarkup(
    React.createElement(FollowControls, {
      audience: 'private',
      id: 'doc',
      onChanged: async () => {},
      state: {
        following: true,
        available: true,
        revision: 2,
        marker: 'a'.repeat(64),
        unread: true,
        research: { total: 8, unseen: 3, latest_at: '2026-09-28T02:00:00Z' },
      },
    }),
  );
  assert.match(html, /3 unseen research updates/);
  assert.match(html, /Mark current updates seen/);
  assert.match(html, /does not verify or approve findings/);
  assert.match(html, /Stop following/);
});

test('whole-dossier preparation continues checkpoints with a fixed scope and resumes only until ranking is ready', async () => {
  const initial = { query: 'private question', mode: 'corpus', offset: 0 };
  const progress = [],
    calls = [];
  const responses = [16, 30, null].map((ready) => ({
    ...evidencePage,
    mode: 'corpus',
    method: 'local_corpus_hybrid',
    preparing: ready !== null,
    prepared_records: ready ?? 30,
    examined_records: ready === null ? 30 : 0,
  }));
  const result = await completeEvidenceSearch(
    initial,
    async (body) => {
      calls.push(body);
      return responses[calls.length - 1];
    },
    () => true,
    (page) => progress.push(page.prepared_records),
  );
  assert.deepEqual(progress, [16, 30]);
  assert.equal(result, responses[2]);
  assert.deepEqual(calls[0], initial);
  assert.equal(calls[1].as_of, evidencePage.as_of);
  assert.equal(calls[2].fingerprint, evidencePage.fingerprint);
  assert.equal(calls.length, 3);
});

test('stopping or changing session prevents late preparation from sending the next request', async () => {
  let current = true,
    calls = 0,
    updates = 0;
  const result = await completeEvidenceSearch(
    { query: 'private question', mode: 'corpus', offset: 0 },
    async () => {
      calls++;
      current = false;
      return {
        ...evidencePage,
        mode: 'corpus',
        preparing: true,
        prepared_records: 16,
      };
    },
    () => current,
    () => updates++,
  );
  assert.equal(result, null);
  assert.equal(calls, 1);
  assert.equal(updates, 0);
});

test('a stalled preparation or changed fingerprint cannot silently loop or mix scopes', async () => {
  for (const changed of [false, true]) {
    let calls = 0;
    await assert.rejects(
      completeEvidenceSearch(
        { query: 'private question', mode: 'corpus', offset: 0 },
        async () => ({
          ...evidencePage,
          mode: 'corpus',
          preparing: true,
          prepared_records: 16,
          fingerprint:
            ++calls > 1 && changed ? 'c'.repeat(64) : evidencePage.fingerprint,
        }),
        () => true,
        () => {},
      ),
      changed ? /Saved evidence changed/ : /did not advance/,
    );
    assert.equal(calls, 2);
  }
});

test('corpus results distinguish full ranking, optional model opinions and exact citation limits', () => {
  const html = renderToStaticMarkup(
    React.createElement(EvidenceSearchResults, {
      page: {
        ...evidencePage,
        mode: 'corpus',
        method: 'local_corpus_hybrid',
        examined_records: 30,
        items: [
          {
            ...evidenceItem,
            semantic_similarity: 0.83,
            embedding_truncated: true,
            relevance_probability: null,
            semantic_match: false,
            confidence: null,
          },
        ],
        measurement: { ...evidencePage.measurement, error: 'timeout' },
      },
      onOpen() {},
      onPage() {},
    }),
  );
  assert.match(html, /30 records ranked across this dossier/);
  assert.match(html, /More ranked results/);
  assert.match(html, /full dossier ranking and exact sources remain available/);
  assert.match(html, /first 512 tokens/);
  assert.match(html, /not a truth or accuracy score/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /Search older|Model relevance probability|83%/);
});

const { ProductDestinations } = require(
  resolve('components/product-destinations.tsx'),
);
const { productNavigationCopy } = require(resolve('lib/product-navigation.ts'));
test('product navigation preserves the current tab and never carries private context to another origin', () => {
  const destinations = {
    pharma: 'https://pharma.helveticlens.ch/',
    legal: 'https://legal.helveticlens.ch/',
    platform: 'https://helveticlens.ch/',
  };
  for (const current of Object.keys(destinations)) {
    const html = renderToStaticMarkup(
      React.createElement(ProductDestinations, {
        current,
        question: 'CONFIDENTIAL_QUESTION',
        dossierId: 'PRIVATE_ID',
        credential: 'SECRET_VALUE',
      }),
    );
    const links = [...html.matchAll(/<a ([^>]+)>/g)].map(
      ([_, attributes]) => attributes,
    );
    assert.equal(links.length, 2);
    assert.match(html, /aria-current="true"/);
    assert.doesNotMatch(html, /CONFIDENTIAL_QUESTION|PRIVATE_ID|SECRET_VALUE/);
    for (const attributes of links) {
      const href = attributes.match(/href="([^"]+)"/)[1];
      assert.ok(
        Object.entries(destinations).some(
          ([id, url]) => id !== current && url === href,
        ),
      );
      assert.equal(new URL(href).search, '');
      assert.equal(new URL(href).hash, '');
      assert.match(attributes, /target="_blank"/);
      assert.match(attributes, /rel="noopener noreferrer"/);
      assert.match(attributes.toLowerCase(), /referrerpolicy="no-referrer"/);
      assert.match(attributes, /aria-label="[^"]+Opens in a new tab"/);
    }
  }
});
test('all native product navigation locales expose current location and external-link meaning', () => {
  assert.deepEqual(Object.keys(productNavigationCopy), [
    'en-CH',
    'de-CH',
    'fr-CH',
    'it-CH',
    'rm-CH',
  ]);
  for (const copy of Object.values(productNavigationCopy)) {
    const html = renderToStaticMarkup(
      React.createElement(ProductDestinations, { current: 'platform', copy }),
    );
    assert.ok(html.includes(copy.title));
    assert.ok(html.includes(copy.current));
    assert.ok(html.includes(copy.opens));
    assert.ok(html.includes(copy.note));
  }
});

const {
  EntityIdentities,
  EntityIdentityCard,
} = require('../components/entity-identity.tsx');
const { currentIdentities } = require('../lib/entity-identity.ts');
const entityMention = {
  id: 'mention-one',
  investigation_id: 'run-one',
  name: 'Fictional Alpine Example',
  kind: 'organization',
  identifier: {
    value: 'DEMO-123',
    issuer: 'Demo Registry',
    jurisdiction: 'Switzerland',
    kind: 'organization',
  },
  quote: 'Fictional Alpine Example has identifier DEMO-123.',
  locator: 'p1',
  source: {
    id: 'source-one',
    title: 'Fictional registry',
    url: 'https://example.test/registry',
    kind: 'fixture',
    sha256: 'a'.repeat(64),
    captured_at: '2026-09-28T12:00:00Z',
  },
};
const entityPair = {
  id: 'one:two',
  entity_id: 'one',
  previous_entity_id: 'two',
  first: entityMention,
  second: { ...entityMention, id: 'mention-two', investigation_id: 'run-two' },
  evidence_fingerprint: 'f'.repeat(64),
  exact_identifier_match: true,
  basis: 'Exact cited identifier; suggestion, not confirmed identity.',
  boundary: 'Original records and claims are unchanged.',
  revision: 0,
  decision: 'unreviewed',
  stale: false,
  history: [],
};
test('entity matching is folded and does not expose reader content or editor controls in the dossier shell', () => {
  const html = renderToStaticMarkup(
    React.createElement(EntityIdentities, {
      base: '/fixture',
      onOpen() {},
      onChange() {},
    }),
  );
  assert.match(html, /Entity matches across research/);
  assert.doesNotMatch(
    html,
    /<details[^>]* open|Save identity review|Matches to review|DEMO-123/,
  );
});
test('entity cards retain both source quotations, identifiers and capture provenance without inferring acceptance', () => {
  const html = renderToStaticMarkup(
    React.createElement(EntityIdentityCard, { value: entityPair, onOpen() {} }),
  );
  assert.equal((html.match(/<blockquote>/g) || []).length, 2);
  for (const text of [
    'Possible match',
    'awaiting review',
    'First mention',
    'Second mention',
    'DEMO-123',
    'Demo Registry',
    'Switzerland',
    'SHA-256',
    'not a publication or effective date',
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(
    html,
    /Same entity · reviewed|ACCEPTED|Save identity review/,
  );
});
test('stale identity decisions show review needed and retain past decisions, with invalid citations unavailable', () => {
  const html = renderToStaticMarkup(
    React.createElement(EntityIdentityCard, {
      value: {
        ...entityPair,
        first: null,
        stale: true,
        revision: 1,
        decision: 'same',
        history: [
          {
            revision: 1,
            decision: 'same',
            reason: 'Previous evidence supported the pair.',
            at: '2026-09-28T12:00:00Z',
            reviewer: 'Former dossier editor',
          },
        ],
      },
      onOpen() {},
    }),
  );
  for (const text of [
    'Evidence changed',
    'not a current identity confirmation',
    'cannot currently be validated',
    'Previous evidence supported the pair.',
    'Former dossier editor',
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Save identity review/);
});
test('entity reader fences errors, pagination and changed public/private revision', () => {
  const value = { items: [entityPair], offset: 0, publication_revision: 2 };
  assert.equal(currentIdentities(value, '', 0, 2), value);
  for (const args of [
    [value, 'Access failed', 0, 2],
    [value, '', 20, 2],
    [value, '', 0, 3],
    [value, '', 0],
    [null, '', 0, 2],
  ])
    assert.equal(currentIdentities(...args), null);
});

const { ClaimReviewCard } = require(resolve('components/claim-review.tsx'));
const { currentClaimReviews } = require(resolve('lib/claim-review.ts'));
const reviewedFixture = {
  id: 'claim',
  claim: {
    id: 'claim',
    investigation_id: 'run',
    statement: 'Fictional retained assertion',
    revision: 1,
    evidence_status: 'CONTESTED',
  },
  evidence: [
    {
      id: 'e',
      relation: 'CONTRADICTS',
      quote: '<script>Fictional contradiction</script>',
      locator: 'p1',
      valid: true,
      source: {
        id: 's',
        title: 'Fictional evidence',
        url: 'javascript:unsafe()',
        sha256: 'a'.repeat(64),
        captured_at: '2026-09-29T00:00:00Z',
      },
    },
  ],
  comparisons: [],
  complete: true,
  reviewable: true,
  evidence_fingerprint: 'f'.repeat(64),
  limits: { citations: 100, comparisons: 20 },
  revision: 1,
  decision: 'accepted',
  stale: false,
  human_status: 'ACCEPTED',
  finding_status: 'ACCEPTED',
  history_unavailable: false,
  history: [
    {
      revision: 1,
      decision: 'accepted',
      reason: 'Fictional reason',
      at: '2026-09-29T00:00:00Z',
      reviewer: 'Former dossier editor',
      evidence_fingerprint: 'f'.repeat(64),
      basis: {
        sources: [{ id: 's', sha256: 'a'.repeat(64) }],
        claims: [{ id: 'claim', revision: 1 }],
      },
    },
  ],
};
test('human claim acceptance is separate from machine evidence and keeps exact contradictions safely escaped', () => {
  const html = renderToStaticMarkup(
    React.createElement(ClaimReviewCard, {
      value: reviewedFixture,
      onOpen() {},
    }),
  );
  assert.match(html, /Accepted by an editor/);
  assert.match(html, /Machine evidence assessment: contested/);
  assert.match(html, /Contradicting evidence/);
  assert.match(html, /Former dossier editor/);
  assert.match(html, /&lt;script&gt;Fictional contradiction/);
  assert.doesNotMatch(html, /href="javascript:|<script>/);
});
test('changed evidence removes current acceptance and inaccessible historical notes stay hidden', () => {
  const html = renderToStaticMarkup(
    React.createElement(ClaimReviewCard, {
      value: {
        ...reviewedFixture,
        decision: null,
        stale: true,
        history: [],
        history_unavailable: true,
      },
      onOpen() {},
    }),
  );
  assert.match(html, /Evidence changed/);
  assert.match(html, /earlier review explanations are hidden/);
  assert.doesNotMatch(html, /Accepted by an editor|Fictional reason/);
});
test('partial claim evidence explains the review limit', () => {
  const html = renderToStaticMarkup(
    React.createElement(ClaimReviewCard, {
      value: { ...reviewedFixture, complete: false, reviewable: false },
      onOpen() {},
    }),
  );
  assert.match(html, /100 citations or 20 comparisons/);
  assert.match(html, /partial review cannot be saved/);
});
test('claim review reader fences stale pages, publication revisions and errors', () => {
  const page = { items: [], offset: 10, publication_revision: 4 };
  assert.equal(currentClaimReviews(page, '', 10, 4), page);
  assert.equal(currentClaimReviews(page, 'Forbidden', 10, 4), null);
  assert.equal(currentClaimReviews(page, '', 0, 4), null);
  assert.equal(currentClaimReviews(page, '', 10, 5), null);
  assert.equal(currentClaimReviews(page, '', 10), null);
});

for (const [decision, stale, expected] of [
  ['accepted', false, 'Accepted by an editor'],
  ['dismissed', false, 'Dismissed by an editor'],
  ['needs_more_evidence', false, 'More evidence requested'],
  [null, false, 'Not reviewed'],
  ['accepted', true, 'Evidence changed — review again'],
])
  test(`search keeps human ${decision}/${stale} separate from contested source evidence`, () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceSearchResult, {
        item: {
          ...evidenceItem,
          citation_relation: 'CONTRADICTS',
          human_review: {
            revision: 1,
            decision,
            stale,
            human_status: stale ? 'UNRESOLVED' : 'ACCEPTED',
            complete: false,
            reviewable: false,
            has_conflicting_evidence: true,
          },
        },
        onOpen() {},
      }),
    );
    assert.ok(html.includes(expected));
    assert.match(html, /Finding · Contested|Finding · contested/);
    assert.match(
      html,
      /Citation relationship:.*Contradicts|Citation relationship:.*contradicts/,
    );
    assert.match(html, /Conflicting evidence is recorded/);
    assert.match(html, /Review context is incomplete/);
    assert.match(html, /&lt;img/);
    assert.match(html, /&lt;script&gt;/);
    if (stale) assert.doesNotMatch(html, /Accepted by an editor/);
  });

const { ResearchClaims } = require(resolve('components/research-claims.tsx'));
test('claim research displays human review separately and preserves dismissed contradictions and exact quotes', () => {
  const claims = [
    {
      id: 'claim',
      statement: 'Fictional <script>claim</script>',
      machine_status: 'CONTESTED',
      human_review: {
        revision: 1,
        decision: 'accepted',
        stale: false,
        human_status: 'ACCEPTED',
      },
      citations: ['S1'],
      comparisons: [
        {
          kind: 'CONTRADICTS',
          status: 'dismissed',
          statement: 'Different source interpretation',
          machine_status: 'SUPPORTED',
          citations: ['S2'],
        },
      ],
    },
  ];
  const sources = [
    {
      id: 'S1',
      kind: 'investigation_quote',
      relation: 'SUPPORTS',
      title: 'Retained source',
      locator: 'p1',
      text: 'Exact <script>quotation</script>',
    },
    {
      id: 'S2',
      kind: 'investigation_quote',
      relation: 'CONTRADICTS',
      title: 'Counter source',
      locator: 'p2',
      text: 'Exact contrary quotation',
    },
  ];
  const html = renderToStaticMarkup(
    React.createElement(ResearchClaims, { claims, sources }),
  );
  for (const value of [
    'CONTESTED',
    'accepted',
    'CONTRADICTS',
    'dismissed',
    'Exact contrary quotation',
    'not independent verification',
  ])
    assert.ok(html.includes(value), value);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  claims[0].human_review.stale = true;
  const stale = renderToStaticMarkup(
    React.createElement(ResearchClaims, { claims, sources }),
  );
  assert.ok(stale.includes('Changed — review again'));
  assert.ok(!stale.includes('Human review: accepted'));
});

test('reviewed synthesis keeps each claim classification and citation role distinct and escapes editor labels', () => {
  const context = (kind, label, role) => ({
    schema_version: 1,
    status: 'current',
    interpretation: {
      kind,
      kind_label: kind,
      label,
      claim_type: 'fixture',
      domain_pack: 'LegalPack',
      domain_pack_version: '1.4.0',
    },
    source_assessments: {
      domain_pack: 'LegalPack',
      domain_pack_version: '1.4.0',
      items: [
        {
          citation_id: 'S1',
          source_record_id: 'capture',
          category: 'fixture',
          label: role,
          status: 'current',
        },
      ],
    },
  });
  const claims = [
    {
      id: 'own',
      statement: 'Own statement',
      machine_status: 'CONTESTED',
      human_review: {
        revision: 1,
        decision: 'accepted',
        stale: false,
        human_status: 'ACCEPTED',
      },
      citations: ['S1'],
      editor_context: context(
        'SOURCE_STATEMENT',
        'Court holding',
        'Primary binding material',
      ),
      comparisons: [
        {
          id: 'related',
          kind: 'CONTRADICTS',
          status: 'active',
          statement: 'Related statement',
          machine_status: 'SUPPORTED',
          citations: ['S1'],
          human_review: {
            revision: 1,
            decision: 'needs_more_evidence',
            stale: false,
            human_status: 'UNRESOLVED',
          },
          editor_context: context(
            'AI_INTERPRETATION',
            '<script>Interpretation</script>',
            'User document',
          ),
        },
      ],
    },
  ];
  const html = renderToStaticMarkup(
    React.createElement(ResearchClaims, { claims, sources: [] }),
  );
  assert.ok(
    html.includes('Court holding') && html.includes('AI_INTERPRETATION'),
  );
  assert.ok(
    html.includes('Primary binding material') && html.includes('User document'),
  );
  assert.ok(
    html.includes('&lt;script&gt;Interpretation&lt;/script&gt;') &&
      !html.includes('<script>'),
  );
  assert.equal((html.match(/Editor context supplied to AI/g) || []).length, 2);
  assert.ok(html.includes('needs more evidence'));
  claims[0].editor_context = {
    schema_version: 1,
    status: 'stale',
    interpretation: null,
    source_assessments: {
      domain_pack: null,
      domain_pack_version: null,
      items: [
        {
          citation_id: 'S1',
          source_record_id: 'capture',
          category: 'UNASSESSED',
          label: 'Not assessed',
          status: 'stale',
        },
      ],
    },
  };
  const stale = renderToStaticMarkup(
    React.createElement(ResearchClaims, { claims, sources: [] }),
  );
  assert.ok(stale.includes('assessments unknown'));
  assert.ok(
    !stale.includes('Court holding') &&
      !stale.includes('Primary binding material'),
  );
  assert.ok(stale.includes('User document'));
});

const { ResearchPost } = require(resolve('components/discussion.tsx'));
for (const separated of [false, true])
  test(`research note ${separated ? 'separates quotations and interpretation' : 'keeps legacy presentation'}`, () => {
    const quote = 'Fictional <script>quotation</script>';
    const post = {
      id: 'n',
      kind: 'research',
      thread_id: 'q',
      body: 'Retained fallback',
      url: '',
      data: {
        sources: [
          {
            id: 'S1',
            key: 'source',
            kind: 'team_contribution',
            title: 'Team opinion',
            text: 'Saved snapshot',
            url: 'https://example.test/evidence',
            date: '2026-09-29T00:00:00Z',
          },
        ],
        findings: [
          {
            kind: 'SOURCE_QUOTE',
            claim: quote,
            citations: [{ source_id: 'S1', quote }],
          },
          {
            kind: 'AI_INTERPRETATION',
            claim: 'Fictional AI inference requiring review.',
            citations: [
              { source_id: 'S1', quote: 'Other supporting excerpt.' },
            ],
          },
        ],
        unknowns: ['Still unknown.'],
        search_queries: [],
        ...(separated
          ? {
              answer_format: 'source_analysis_v1',
              answer_contract: {
                id: 'source-analysis/v1',
                schema_version: 1,
                labels: {
                  SOURCE_QUOTE: 'Quoted saved text',
                  AI_INTERPRETATION: 'AI interpretation',
                },
                boundary: 'Quotation is not truth.',
              },
            }
          : {}),
      },
    };
    const html = renderToStaticMarkup(
      React.createElement(ResearchPost, {
        dossierId: 'd',
        post,
        onSearch() {},
      }),
    );
    assert.equal(
      (html.match(/Fictional &lt;script&gt;quotation&lt;\/script&gt;/g) || [])
        .length,
      separated ? 1 : 2,
    );
    assert.match(html, /Fictional AI inference requiring review/);
    assert.match(html, /Team opinion.*team contribution/);
    assert.match(html, /https:\/\/example.test\/evidence/);
    assert.match(html, /verify before accepting/);
    assert.doesNotMatch(html, /<script>/);
    if (separated) {
      assert.match(html, /<h4>Quoted saved text<\/h4>/);
      assert.match(html, /<h4>AI interpretation<\/h4>/);
      assert.match(html, /Quotation is not truth/);
    } else
      assert.doesNotMatch(html, /Quoted saved text|Quotation is not truth/);
  });

const { CheckSourceCoverageReader } = require(resolve('components/check-source-coverage.tsx'));
const checkedSource = {
  title: '<script>Captured registry</script>', url: 'https://example.org/registry',
  source_id: 'captured', investigation_id: 'run-first', read_status: 'read',
  analysis_status: 'analysed', capture_state: 'changed', attempt_count: 1,
  attempt: { status: 'completed', started_at: '2026-09-30T12:00:00Z', finished_at: '2026-09-30T12:01:00Z' },
  last_success_at: '2026-09-30T12:02:00Z',
};
const checkCoverage = {
  contract: 'check-source-coverage/v1', recorded: true, scope: 'Returned sources only; earlier captures are not automatically revisited.',
  sources: [checkedSource], search: { status: 'completed' }, prior_limit: 12, prior_truncated: false, prior_hidden: 0,
};
function renderCoverage(value) {
  return renderToStaticMarkup(React.createElement(CheckSourceCoverageReader, { value, onOpen() {} }));
}
test('source coverage opens inline, escapes titles and connects retained evidence', () => {
  const html = renderCoverage(checkCoverage);
  assert.match(html, /<details[^>]*><summary>Sources in this check/);
  assert.doesNotMatch(html, /<details[^>]*open|<script>/);
  assert.match(html, /&lt;script&gt;Captured registry/);
  assert.match(html, /href="https:\/\/example.org\/registry"/);
  assert.match(html, /noopener noreferrer nofollow ugc/);
  assert.match(html, /Captured text differs/);
  assert.match(html, /Last successful analysis/);
  assert.match(html, /Open captured evidence/);
});
for (const [read_status, expected] of Object.entries({
  reading: 'Reading started; no result recorded', failed: 'Could not read', interrupted: 'Reading interrupted',
  not_checked: 'Not checked this time', unavailable: 'Source no longer available',
})) test(`source ${read_status} never renders retained capture success`, () => {
  const html = renderCoverage({ ...checkCoverage, sources: [{ ...checkedSource, read_status, last_success_at: null }] });
  assert.ok(html.includes(expected));
  assert.doesNotMatch(html, /Captured text differs|Evidence analysed|Last successful analysis/);
  if (read_status === 'not_checked') assert.match(html, /Open earlier capture/);
});
test('read but failed analysis is visibly different from failure to read', () => {
  const html = renderCoverage({ ...checkCoverage, sources: [{ ...checkedSource, analysis_status: 'failed', last_success_at: null }] });
  assert.match(html, /Read successfully/);
  assert.match(html, /Read, but analysis failed/);
  assert.doesNotMatch(html, /Last successful analysis|Could not read/);
});
test('unchanged capture explains skipped analysis without implying comprehensive coverage', () => {
  const html = renderCoverage({ ...checkCoverage, sources: [{ ...checkedSource, capture_state: 'unchanged', analysis_status: 'not_needed' }] });
  assert.match(html, /Captured text unchanged/);
  assert.match(html, /analysis was not repeated/);
  assert.match(html, /earlier captures are not automatically revisited/);
});
test('bounded lookback and unavailable older sources stay explicit', () => {
  const html = renderCoverage({ ...checkCoverage, prior_truncated: true, prior_hidden: 1 });
  assert.match(html, /outside this bounded list/);
  assert.match(html, /Some earlier source details are no longer available/);
});
test('legacy source receipts are unavailable rather than retroactively inferred', () => {
  const html = renderCoverage({ ...checkCoverage, recorded: false, scope: 'Receipts were not recorded.' });
  assert.match(html, /history unavailable|not recorded/);
  assert.doesNotMatch(html, /Captured registry|Read successfully|Open captured evidence/);
});
test('unsafe source addresses cannot create executable links', () => {
  const html = renderCoverage({ ...checkCoverage, sources: [{ ...checkedSource, url: 'javascript:alert(1)' }] });
  assert.doesNotMatch(html, /javascript:|href=/);
});
test('unavailable monitoring result hides retained source coverage and unknown contracts are ignored', () => {
  const html = renderToStaticMarkup(React.createElement(MonitoringOutcomeReader, {
    outcome: { ...monitoringResult, state: 'unavailable', source_coverage: checkCoverage }, onOpen() {},
  }));
  assert.doesNotMatch(html, /Sources in this check|Captured registry/);
  assert.equal(renderCoverage({ ...checkCoverage, contract: 'unknown/v2' }), '');
});
