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
