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
const originalElement = globalThis.Element;
const originalHTMLElement = globalThis.HTMLElement;
globalThis.Element = class {};
globalThis.HTMLElement = class {};
globalThis.document = { cookie: 'helvetic_lens_csrf=fixture' };
globalThis.window = {
  location: { search: '?question=q' },
  history: { replaceState() {} },
  Element: globalThis.Element,
  HTMLElement: globalThis.HTMLElement,
  addEventListener() {},
  removeEventListener() {},
};

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
  globalThis.Element = originalElement;
});

Module._load = function(name, parent, ...args) {
  if (name === '@/lib/use-resource') return { useResource: () => ({ data: null, error: '', loading: false, refresh: async () => {} }) };
  return originalLoad.call(this, name, parent, ...args);
};
const { Discussion, ResearchPost } = require(resolve('components/discussion.tsx'));
const { Button } = require(resolve('components/ui/button.tsx'));

test('focused question refresh hides unavailable claim notes and failed reads without replaying inference', async () => {
  const note = { id: 'n', kind: 'research', thread_id: 'q', title: 'Note', body: 'PRIVATE saved conclusion', author: 'Editor', created_at: '2026-09-29T00:00:00Z',
    data: { evidence_scope: 'claims_v1', claim_freshness: { status: 'current', message: '', fingerprint: 'a'.repeat(64) }, unknowns: [], search_queries: [] } };
  let response = { id: 'q', title: 'Fictional question', body: 'Question context', author: 'Editor', created_at: note.created_at,
    revision: 2, replies: [note], reply_count: 1, accepted: null, accepted_entry_id: null, answer_needs_review: false, answer_review: { reasons: [], fingerprint: 'b'.repeat(64) } };
  const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({url, method: init?.method || 'GET'}); return response ? new Response(JSON.stringify(response), {status: 200}) : new Response('Temporary failure', {status: 503}); };
  let tree;
  await act(async () => { tree = create(React.createElement(Discussion, { dossier: { id: 'd', access: { can_contribute: false }, profile: { config: { goal: '' } } }, initialQuestionId: 'q', canEdit: false, busy: '', run() {}, reload: async () => {}, notify() {}, onRefine() {} })); });
  try {
    assert.ok(JSON.stringify(tree.toJSON()).includes('PRIVATE saved conclusion'));
    response = {...response, replies: [{...note, body: 'Research note unavailable', data: { evidence_scope: 'claims_v1', claim_freshness: { status: 'unavailable', message: 'A supporting source is unavailable.', fingerprint: 'c'.repeat(64) } } }]};
    await act(async () => { for (const fn of listeners.get('focus') || []) fn(); });
    assert.ok(!JSON.stringify(tree.toJSON()).includes('PRIVATE saved conclusion'));
    assert.ok(JSON.stringify(tree.toJSON()).includes('A supporting source is unavailable.'));
    response = null;
    await act(async () => { for (const fn of listeners.get('focus') || []) fn(); });
    assert.ok(JSON.stringify(tree.toJSON()).includes('Retry question'));
    assert.ok(!JSON.stringify(tree.toJSON()).includes('A supporting source is unavailable.'));
    assert.ok(requests.length >= 3 && requests.every(value => value.method === 'GET' && value.url.includes('/discussion/q')));
  } finally { await act(async () => tree.unmount()); }
});

test('changed claim note shows a warning and offers no gap-copy action', async () => {
  let tree;
  await act(async () => { tree = create(React.createElement(ResearchPost, { dossierId: 'd', onSearch() {}, onFollowup() {}, post: { id: 'n', kind: 'research', body: 'Retained original answer', data: { claim_freshness: { status: 'changed', message: 'Generate a fresh note.' }, unknowns: ['A question requiring review'] } } })); });
  try {
    const text = JSON.stringify(tree.toJSON());
    assert.ok(text.includes('Generate a fresh note.'));
    assert.ok(!text.includes('Create follow-up'));
  } finally { await act(async () => tree.unmount()); }
});

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}
const thread = (body = 'Saved conclusion', changes = {}) => ({
  id: 'q', title: 'Fictional question', body: 'Question context', author: 'Editor',
  created_at: '2026-09-29T00:00:00Z', revision: 2, reply_count: 100,
  accepted: null, accepted_entry_id: null, answer_needs_review: false,
  answer_review: { reasons: [], fingerprint: 'b'.repeat(64) },
  replies: [{ id: 'n', kind: 'research', thread_id: 'q', body, author: 'Editor',
    created_at: '2026-09-29T00:00:00Z', data: { evidence_scope: 'claims_v1', unknowns: [], search_queries: [] } }],
  ...changes,
});
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
const shown = (tree) => JSON.stringify(tree.toJSON());
const words = (value) => typeof value === 'string' ? value : Array.isArray(value)
  ? value.map(words).join(' ') : value?.props ? words(value.props.children) : '';
const click = (tree, label) => tree.root.findAllByType(Button).find(
  (button) => words(button.props.children).includes(label),
).props.onClick();
const focus = () => { for (const fn of listeners.get('focus') || []) fn(); };
async function discussion() {
  let tree;
  await act(async () => { tree = create(React.createElement(Discussion, {
    dossier: { id: 'd', access: { can_contribute: false }, profile: { config: { goal: '' } } },
    initialQuestionId: 'q', canEdit: false, busy: '', run: async (_label, work) => work(),
    reload: async () => {}, notify() {}, onRefine() {},
  })); });
  return tree;
}

test('slow private discussion refresh survives repeated timer ticks and focus', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const slow = deferred(), requests = [];
  globalThis.fetch = (url, init) => {
    requests.push({ url, method: init?.method });
    return requests.length === 1 ? Promise.resolve(response(thread())) : slow.promise;
  };
  const tree = await discussion();
  try {
    await act(async () => { t.mock.timers.tick(15000); });
    await act(async () => { t.mock.timers.tick(60000); focus(); focus(); });
    assert.equal(requests.length, 2);
    assert.ok(shown(tree).includes('Saved conclusion'));
    await act(async () => { slow.resolve(response(thread('Fresh evidence review'))); });
    assert.ok(shown(tree).includes('Fresh evidence review'));
    assert.ok(!shown(tree).includes('Saved conclusion'));
    assert.ok(requests.every((r) => r.method === 'GET'));
  } finally { await act(async () => tree.unmount()); }
});

test('manual contribution page supersedes a slow background read', async () => {
  const slow = deferred(), page = deferred(), requests = [];
  globalThis.fetch = (url) => {
    requests.push(url);
    return requests.length === 1 ? Promise.resolve(response(thread())) : url.endsWith('offset=50') ? page.promise : slow.promise;
  };
  const tree = await discussion();
  try {
    await act(async () => { focus(); });
    await act(async () => { click(tree, 'Next'); });
    assert.equal(requests.length, 3);
    assert.ok(requests.at(-1).endsWith('offset=50'));
    await act(async () => { slow.resolve(response(thread('Old background response'))); });
    assert.ok(!shown(tree).includes('Old background response'));
    await act(async () => { page.resolve(response(thread('Later contributions'))); });
    assert.ok(shown(tree).includes('Later contributions'));
  } finally { await act(async () => tree.unmount()); }
});

test('leaving a question suppresses a late background failure', async () => {
  const slow = deferred();
  let calls = 0;
  globalThis.fetch = () => ++calls === 1 ? Promise.resolve(response(thread())) : slow.promise;
  const tree = await discussion();
  try {
    await act(async () => { focus(); });
    await act(async () => { click(tree, 'All questions'); });
    await act(async () => { slow.resolve(response({ detail: 'failure' }, 503)); });
    assert.ok(!shown(tree).includes('Retry question'));
    assert.ok(!shown(tree).includes('Saved conclusion'));
  } finally { await act(async () => tree.unmount()); }
});

test('unmounting on navigation or sign-out suppresses a late background success', async () => {
  const slow = deferred(), navigations = [];
  const original = window.history.replaceState.bind(window.history);
  window.history.replaceState = (...args) => navigations.push(args);
  let calls = 0;
  globalThis.fetch = () => ++calls === 1 ? Promise.resolve(response(thread())) : slow.promise;
  const tree = await discussion();
  try {
    await act(async () => { focus(); });
    await act(async () => tree.unmount());
    const count = navigations.length;
    await act(async () => { slow.resolve(response(thread('Late response'))); });
    assert.equal(navigations.length, count);
  } finally { window.history.replaceState = original; }
});

test('failed background read hides unconfirmed notes and retries the exact contribution page', async () => {
  const requests = [];
  let failure = false;
  globalThis.fetch = async (url, init) => {
    requests.push({ url, method: init?.method });
    return failure ? response({ detail: 'unavailable' }, 503) : response(thread(url.endsWith('offset=50') ? 'Page two' : 'Page one'));
  };
  const tree = await discussion();
  try {
    await act(async () => { click(tree, 'Next'); });
    assert.ok(shown(tree).includes('Page two'));
    failure = true;
    await act(async () => { focus(); });
    assert.ok(shown(tree).includes('Retry question'));
    assert.ok(!shown(tree).includes('Page two'));
    failure = false;
    await act(async () => { click(tree, 'Retry question'); });
    assert.ok(shown(tree).includes('Page two'));
    assert.ok(requests.slice(1).every((r) => r.url.endsWith('offset=50') && r.method === 'GET'));
  } finally { await act(async () => tree.unmount()); }
});
