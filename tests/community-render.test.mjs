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
    name === 'next/link'
      ? resolve('node_modules/vinext/dist/shims/link.js')
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
