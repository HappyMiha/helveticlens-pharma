import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Run the real React reconciler and actual parent, with small stateful children
// standing in for independent network readers. No browser or private data.
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
const originalTs = Module._extensions['.ts'];
const originalTsx = Module._extensions['.tsx'];
const originalFetch = globalThis.fetch;
const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
const originalDocument = globalThis.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
const originalWindow = globalThis.window;
const originalHTMLElement = globalThis.HTMLElement;
globalThis.HTMLElement = class {};
globalThis.document = { cookie: 'helvetic_lens_csrf=fixture' };
globalThis.window = {
  HTMLElement: globalThis.HTMLElement,
  addEventListener() {},
  removeEventListener() {},
};
const { EvidenceSearch } = require(resolve('components/evidence-search.tsx'));
const { Input } = require(resolve('components/ui/input.tsx'));
const listeners = new Map();
globalThis.window.addEventListener = (key, fn) => { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(fn); };
globalThis.window.removeEventListener = (key, fn) => listeners.get(key)?.delete(fn);
globalThis.document.getElementById = () => null;
after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolve;
  for (const [ext, value] of [
    ['.ts', originalTs],
    ['.tsx', originalTsx],
  ]) {
    if (value) Module._extensions[ext] = value;
    else delete Module._extensions[ext];
  }
  globalThis.fetch = originalFetch;
  globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct;
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  globalThis.HTMLElement = originalHTMLElement;
});
const finding = {
  id: 'evidence', kind: 'claim', investigation_id: 'run', source_id: 'source',
  title: 'Fictional source', url: '', sha256: 'a'.repeat(64), quote: 'Retained contradictory quotation',
  locator: 'p1', created_at: '2026-09-29T00:00:00Z', statement: 'Fictional finding',
  claim_status: 'CONTESTED', claim_id: 'claim', claim_revision: 1,
  citation_relation: 'CONTRADICTS', text_truncated: false, text_characters: 32,
  semantic_match: false, literal_match: true, relevance_probability: null, confidence: null,
  human_review: { revision: 1, decision: 'accepted', stale: false, human_status: 'ACCEPTED',
    complete: true, reviewable: true, has_conflicting_evidence: true },
};
function page(dossierId = 'dossier') {
  return { dossier_id: dossierId, query: 'Fictional', mode: 'corpus', method: 'local_corpus_hybrid',
    items: [finding], total_records: 1, matching_records: null, examined_records: 1,
    offset: 0, batch_size: 12, next_offset: null, as_of: '2026-09-29T00:00:00Z',
    fingerprint: 'b'.repeat(64), review_claim_ids: ['claim'], review_fingerprint: 'c'.repeat(64),
    coverage: 'Fictional saved sources.', measurement: { latency_ms: 2, requests_completed: 1,
      models: [], error: null, estimated_cost_usd: null, cost_scope: 'Unknown',
      accuracy: null, accuracy_basis: 'Unknown', confidence_definition: 'Unknown' } };
}

test('actual search checks review pins on focus, hides obsolete decisions and never replays search', async () => {
  const requests = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    return body.check_only ? new Response('changed', {status: 409}) : Response.json(page());
  };
  const ref = React.createRef();
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(EvidenceSearch, { dossierId: 'dossier', ref, onOpen() {} })); });
    await act(async () => ref.current.start('Fictional'));
    assert.match(JSON.stringify(tree.toJSON()), /Accepted by an editor/);
    await act(async () => { for (const fn of listeners.get('focus') || []) await fn(); });
    assert.equal(requests.length, 2);
    assert.equal(requests[1].check_only, true);
    assert.deepEqual(requests[1].review_claim_ids, ['claim']);
    assert.equal(requests[1].review_fingerprint, 'c'.repeat(64));
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /Accepted by an editor|Retained contradictory quotation/);
    assert.match(JSON.stringify(tree.toJSON()), /finding reviews or access could not be confirmed/);
    assert.equal(tree.root.findByType('input').props.value, 'Fictional');
  } finally { if(tree) await act(async () => tree.unmount()); }
});

test('review save invalidates only its dossier and late search response cannot restore old acceptance', async () => {
  let resolvePending;
  let pending = false;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (pending) return new Promise(resolve => { resolvePending = resolve; });
    return Response.json(page(url.includes('/other/') ? 'other' : 'dossier'));
  };
  const first = React.createRef(), other = React.createRef();
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(React.Fragment, null,
      React.createElement(EvidenceSearch, { dossierId: 'dossier', ref: first, onOpen() {} }),
      React.createElement(EvidenceSearch, { dossierId: 'other', ref: other, onOpen() {} }))); });
    await act(async () => { first.current.start('Fictional'); other.current.start('Fictional'); });
    assert.equal((JSON.stringify(tree.toJSON()).match(/Accepted by an editor/g) || []).length, 2);
    await act(async () => first.current.invalidate());
    assert.equal((JSON.stringify(tree.toJSON()).match(/Accepted by an editor/g) || []).length, 1);
    assert.equal(calls.length, 2);
    pending = true;
    await act(async () => first.current.start('Fictional'));
    await act(async () => first.current.invalidate());
    await act(async () => resolvePending(Response.json(page())));
    assert.equal((JSON.stringify(tree.toJSON()).match(/Accepted by an editor/g) || []).length, 1);
    assert.equal(calls.length, 3);
    assert.match(JSON.stringify(tree.toJSON()), /Finding review changed/);
    assert.ok(tree.root.findAllByType('input').every(input => input.props.value === 'Fictional'));
  } finally { if(tree) await act(async () => tree.unmount()); }
});

const retryPage = (tree) => tree.root.findAllByType('button').find((button) => button.props.children === 'Retry this page');
async function failedNextPage(t, status = 503, mode = 'corpus') {
  const calls = [];
  let fail = true;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    if (body.offset && fail) {
      if (status === null) throw new Error('Lost transport');
      return new Response('', { status });
    }
    return Response.json({ ...page(), mode, offset: body.offset, next_offset: body.offset ? null : 12, total_records: 24 });
  };
  const ref = React.createRef();
  let tree;
  await act(async () => { tree = create(React.createElement(EvidenceSearch, { dossierId: 'dossier', ref, onOpen() {} })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  await act(async () => ref.current.start('Fictional'));
  if (mode !== 'corpus') {
    await act(async () => tree.root.findByType('select').props.onChange({ target: { value: mode } }));
    await act(async () => tree.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  }
  // Exercise the actual result reader's next-page action for every search mode.
  const next = tree.root.findAllByType('button').find((button) => {
    const children = button.props.children;
    return children === 'More ranked results' || (React.isValidElement(children) && children.type === React.Fragment && children.props.children[0] === 'Search older ');
  });
  assert.ok(next);
  await act(async () => next.props.onClick());
  assert.equal(calls.at(-1).body.offset, 12);
  assert.doesNotMatch(JSON.stringify(tree.toJSON()), /Retained contradictory quotation/);
  return { tree, calls, ref, recover: () => { fail = false; } };
}

for (const [mode, status] of [['corpus', 503], ['semantic', null], ['literal', 429]]) test(`explicit ${mode} page retry preserves its saved position after ${status ?? 'network failure'}`, async (t) => {
  const search = await failedNextPage(t, status, mode);
  const failed = search.calls.at(-1);
  assert.ok(retryPage(search.tree));
  assert.equal(failed.body.as_of, page().as_of);
  if (mode === 'corpus') assert.equal(failed.body.fingerprint, page().fingerprint);
  const count = search.calls.length;
  search.recover();
  await act(async () => retryPage(search.tree).props.onClick());
  assert.equal(search.calls.length, count + 1);
  assert.deepEqual(search.calls.at(-1), failed);
  assert.match(JSON.stringify(search.tree.toJSON()), /Retained contradictory quotation/);
  assert.equal(retryPage(search.tree), undefined);
});

for (const status of [403, 409]) test(`search ${status} requires a fresh search rather than replaying the old page`, async (t) => {
  const search = await failedNextPage(t, status);
  assert.equal(retryPage(search.tree), undefined);
  assert.equal(search.calls.length, 2);
});

for (const boundary of ['query', 'mode', 'session', 'review']) test(`changing ${boundary} discards an obsolete search-page retry`, async (t) => {
  const search = await failedNextPage(t);
  assert.ok(retryPage(search.tree));
  const count = search.calls.length;
  await act(async () => {
    if (boundary === 'query') search.tree.root.findByType(Input).props.onChange({ target: { value: 'A different question' } });
    if (boundary === 'mode') search.tree.root.findByType('select').props.onChange({ target: { value: 'literal' } });
    if (boundary === 'session') for (const fn of listeners.get('helvetic-session-changed') || []) fn();
    if (boundary === 'review') search.ref.current.invalidate();
  });
  assert.equal(retryPage(search.tree), undefined);
  assert.equal(search.calls.length, count, 'Changing context never resubmits a page');
});
