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
after(() => {
  Module._resolveFilename = originalResolve;
  if (originalCss) Module._extensions['.css'] = originalCss;
  else delete Module._extensions['.css'];
  if (originalTs) Module._extensions['.ts'] = originalTs;
  else delete Module._extensions['.ts'];
  if (originalTsx) Module._extensions['.tsx'] = originalTsx;
  else delete Module._extensions['.tsx'];
});

const { CoverageReading, DossierCoveragePanel } = require(
  resolve('components/dossier-coverage.tsx'),
);
const { pageCoverage, packCoverage, streamCoverage } = require(
  resolve('lib/dossier-coverage.ts'),
);
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
const stream = {
  connector: 'official',
  stream: 'updates',
  publisher: 'Authority',
  catalogue_state: 'available',
  known_gaps: [],
  configured: true,
  enabled: true,
  next_attempt_past_due: false,
  last_reported_health: 'healthy',
  last_run_status: 'completed',
  last_attempt_at: '2026-09-28T10:00:00Z',
  last_success_at: '2026-09-28T10:00:00Z',
  next_run_at: '2026-09-29T10:00:00Z',
};
const pack = {
  id: 'official',
  name: { 'en-CH': 'Official collection' },
  definition_state: 'active',
  subscription_enabled: true,
  subscription_state: 'active',
  streams: [stream],
  unsupported_streams: [],
};
const page = {
  id: 'page',
  name: '<script>Original page',
  url: 'https://example.ch/source',
  last_checked: '2026-09-28T10:00:00Z',
  last_success_at: '2026-09-27T10:00:00Z',
  last_result: 'failed',
  last_error: 'Temporarily unavailable',
  active: true,
  auto_check_enabled: true,
};
function value(extra = {}) {
  return {
    schema_id: 'dossier-coverage/v1',
    dossier_id: 'dossier',
    captured_at: '2026-09-28T10:00:00Z',
    profile_status: 'active',
    documents: [],
    topics: [],
    packs: [],
    web_research: {
      enabled: false,
      revision: 0,
      reason: 'Recurring public search is off.',
      last_scheduler_check_at: null,
      latest_run: null,
    },
    limitations: ['Saved operational records only.'],
    ...extra,
  };
}
const callbacks = { onMonitoring() {}, onInvestigation() {} };

test('source reader distinguishes failed attempt from old success and escapes original title', () => {
  const html = render(CoverageReading, {
    value: value({ documents: [page] }),
    ...callbacks,
  });
  assert.match(html, /Last check failed/);
  assert.match(html, /Last successful check/);
  assert.match(html, /Last attempt/);
  assert.match(html, /2026-09-27T10:00:00Z/);
  assert.match(html, /2026-09-28T10:00:00Z/);
  assert.match(html, /&lt;script&gt;Original page/);
  assert.match(html, /href="https:\/\/example.ch\/source"/);
  assert.match(html, /Temporarily unavailable/);
  assert.doesNotMatch(html, /<script>|Complete coverage|No changes occurred/);
});

test('retained unavailable sources and paused topics stay visible with source limits', () => {
  const html = render(CoverageReading, {
    value: value({
      topics: [
        {
          id: 'topic',
          name: 'Question',
          status: 'paused',
          revision: 3,
          pack_ids: ['official'],
        },
      ],
      packs: [
        {
          ...pack,
          definition_state: 'inactive',
          streams: [
            {
              ...stream,
              known_gaps: ['Historical editions not covered'],
              last_run_status: 'partial',
            },
          ],
          unsupported_streams: [{ connector: 'unknown', stream: 'new-feed' }],
        },
        {
          ...pack,
          id: 'gone',
          definition_state: 'missing',
          name: {},
          streams: [],
        },
      ],
    }),
    ...callbacks,
  });
  for (const phrase of [
    'matching paused',
    'revision 3',
    'Catalogue entry inactive',
    'Collection incomplete',
    'Historical editions not covered',
    'Unsupported source',
    'No longer in the catalogue',
    'does not mean every document',
  ])
    assert.ok(html.includes(phrase), phrase);
  assert.doesNotMatch(html, /<details[^>]*open/);
});

test('draft and empty sources never become successful coverage', () => {
  const html = render(CoverageReading, {
    value: value({ profile_status: 'draft' }),
    ...callbacks,
  });
  for (const phrase of [
    'Draft choices only',
    'No pages connected',
    'No saved monitoring topics',
    'No source collections selected',
    'No recurring investigation recorded',
    'Coverage has limits',
  ])
    assert.ok(html.includes(phrase), phrase);
  assert.doesNotMatch(
    html,
    /Successful check recorded|Successful collection recorded/,
  );
});

test('synthetic, unscheduled, partial and unknown source states cannot appear healthy', () => {
  assert.equal(pageCoverage({ ...page, synthetic: true }).attention, true);
  assert.equal(
    pageCoverage({ ...page, last_result: 'unchanged', active: false }).label,
    'Paused',
  );
  assert.equal(
    pageCoverage({ ...page, last_result: 'unchanged', last_success_at: null })
      .attention,
    true,
  );
  assert.equal(streamCoverage(stream).attention, false);
  for (const change of [
    { configured: false },
    { enabled: false },
    { last_reported_health: 'error' },
    { last_reported_health: 'unknown' },
    { last_run_status: 'partial' },
    { next_attempt_past_due: true },
    { last_success_at: null },
    { catalogue_state: 'partial' },
  ])
    assert.equal(streamCoverage({ ...stream, ...change }).attention, true);
  assert.equal(packCoverage(pack).attention, false);
  assert.equal(
    packCoverage({ ...pack, subscription_enabled: false }).attention,
    true,
  );
  assert.equal(packCoverage({ ...pack, streams: [] }).attention, true);
});

test('scheduling and previous completed investigation do not imply fresh source coverage', () => {
  const html = render(CoverageReading, {
    value: value({
      web_research: {
        enabled: true,
        revision: 3,
        reason: 'Waiting for capacity.',
        last_scheduler_check_at: '2026-09-28T10:00:00Z',
        latest_run: {
          id: 'run',
          status: 'completed',
          policy_revision: 2,
          created_at: '2026-09-27T10:00:00Z',
        },
      },
    }),
    ...callbacks,
  });
  assert.match(html, /scheduling check is not a successful source search/);
  assert.match(html, /from earlier search settings/);
  assert.match(html, /Read investigation &amp; source limits/);
});

test('initial coverage read shows loading instead of an empty or successful list', () => {
  const html = render(DossierCoveragePanel, {
    dossierId: 'dossier',
    refreshToken: 0,
    ...callbacks,
  });
  assert.match(html, /Reading saved source status/);
  assert.match(html, /Refresh status/);
  assert.doesNotMatch(html, /No pages connected|Successful check recorded/);
});
