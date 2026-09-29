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
