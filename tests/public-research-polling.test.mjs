import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Exercise actual mounted product readers with deferred HTTP responses and
// simulated background time. No browser, provider calls or private data.
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
  history: { pushState() {}, replaceState() {} },
  location: { href: 'https://example.test/public-dossiers/p', pathname: '/public-dossiers/p', search: '', hash: '' },
  HTMLElement: globalThis.HTMLElement, addEventListener() {}, removeEventListener() {} };
// Keep all product readers and request lifecycles real; the select popup needs
// browser layout and is not part of this background-read regression.
Module._load = function (name, parent, ...args) {
  if (parent?.filename.endsWith('/components/public-research.tsx') && name === './ui/select') {
    const element = ({ children }) => React.createElement('div', null, children);
    return Object.fromEntries(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue']
      .map((name) => [name, element]));
  }
  return originalLoad.call(this, name, parent, ...args);
};
const { EntityIdentities } = require(resolve('components/entity-identity.tsx'));
const { ClaimReviews } = require(resolve('components/claim-review.tsx'));
const { ClaimEvolution } = require(resolve('components/claim-evolution.tsx'));
const { PublicResearchView } = require(resolve('components/public-research.tsx'));
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

const output = (tree) => JSON.stringify(tree.toJSON());
const emptyPage = { items: [], total: 0, offset: 0, page_size: 20, publication_revision: 1,
  boundary: 'Current accessible evidence', coverage: 'Accessible evidence only' };
function pendingReads() {
  const requests = [];
  globalThis.fetch = (url, init) => new Promise((resolve) => requests.push({ url, init, resolve }));
  return requests;
}

for (const [Component, path, reload, folded] of [
  [ClaimReviews, 'claim-reviews', 'Reload findings', true],
  [EntityIdentities, 'entity-identities', 'Reload entity matches', true],
  [ClaimEvolution, 'evidence-changes', 'Refresh comparisons', false],
]) test(`${path} lets slow evidence and permission reads finish while explicit reload supersedes them`, async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const requests = pendingReads();
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(Component, {
      base: `/products/legal/public-dossiers/p/${path}`, publicationRevision: 1, accountKey: 'account',
      onOpen() {}, onChange() {},
    })); });
    if (folded) await act(async () => tree.root.findByType('details').props.onToggle({ currentTarget: { open: true } }));
    assert.equal(requests.length, 2);
    await act(async () => t.mock.timers.tick(45000));
    assert.equal(requests.length, 2, 'Background polls must reuse the active evidence and permission reads');
    assert.ok(requests.every((r) => !r.init.signal.aborted));
    await act(async () => {
      for (const r of requests) r.resolve(Response.json(r.url.includes('/workspace?') ? { can_review: true } : emptyPage));
    });
    assert.match(output(tree), /Current accessible evidence|Accessible evidence only/);
    await act(async () => t.mock.timers.tick(15000));
    assert.equal(requests.length, 4, 'Polling resumes after both reads finish');
    const replaced = requests.slice(2);
    await act(async () => tree.root.findAllByType('button').find((b) => b.props.children === reload).props.onClick());
    assert.equal(requests.length, 6);
    assert.ok(replaced.every((r) => r.init.signal.aborted));
    await act(async () => {
      for (const r of requests.slice(4)) r.resolve(new Response('denied', { status: 403 }));
      for (const r of replaced) r.resolve(Response.json(r.url.includes('/workspace?') ? { can_review: true } :
        { ...emptyPage, boundary: 'OBSOLETE evidence', coverage: 'OBSOLETE evidence' }));
    });
    assert.doesNotMatch(output(tree), /OBSOLETE evidence|Current accessible evidence|Accessible evidence only/);
    assert.match(output(tree), /hidden until|Access|permission|denied/i);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

const run = { id: 'r', question: 'Public research question', status: 'running', revision: 2, stop_reason: '',
  sources: [], evidence: [], entities: [], relationships: [], plans: [], branches: [], activity: [],
  claims: [{ id: 'c', statement: 'Saved public finding', status: 'SUPPORTED', revision: 1, history: [] }],
  evidence_basis: 'Read the original evidence', coverage: 'Public material only' };

test('public research coalesces polling and stream updates without starving slow reads or weakening access withdrawal', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const previousWindow = globalThis.window, previousEvents = globalThis.EventSource;
  const listeners = new Map(), streams = [];
  globalThis.window = { HTMLElement: globalThis.HTMLElement, location: { hash: '' },
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); } };
  globalThis.EventSource = class {
    constructor() { this.listeners = new Map(); streams.push(this); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    emit(name) { this.listeners.get(name)?.({}); }
    close() {}
  };
  const requests = pendingReads();
  const page = { ...emptyPage, items: [run], total: 1, living_research: true };
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(PublicResearchView, {
      publicationId: 'p', revision: 1, selectedId: 'r', initial: page, initialValue: run,
    })); });
    const session = requests.find((r) => r.url.endsWith('/auth/session'));
    await act(async () => session.resolve(Response.json({ authenticated: false })));
    assert.match(output(tree), /Saved public finding/);
    const reads = requests.filter((r) => r !== session);
    assert.equal(reads.length, 3, 'List, detail and visible evidence history each start once');
    await act(async () => {
      t.mock.timers.tick(45000);
      streams.at(-1).emit('checkpoint');
      streams.at(-1).emit('activity');
      t.mock.timers.tick(251);
    });
    assert.equal(requests.length, 4);
    assert.ok(reads.every((r) => !r.init.signal.aborted));
    await act(async () => {
      for (const r of reads) r.resolve(Response.json(r.url.endsWith('/research/r') ? run :
        r.url.includes('/research?') ? page : emptyPage));
    });
    assert.match(output(tree), /Saved public finding/);
    await act(async () => t.mock.timers.tick(15000));
    assert.equal(requests.length, 7);
    const background = requests.slice(4);
    await act(async () => { for (const callback of listeners.get('helvetic-public-research-changed') || []) callback(); });
    assert.ok(background.every((r) => r.init.signal.aborted), 'An explicit update supersedes old background reads');
    const replacement = requests.slice(7);
    await act(async () => streams.at(-1).emit('access_changed'));
    assert.doesNotMatch(output(tree), /Saved public finding/);
    await act(async () => {
      for (const r of [...background, ...replacement]) r.resolve(Response.json(r.url.endsWith('/research/r') ? run :
        r.url.includes('/research?') ? page : emptyPage));
    });
    assert.doesNotMatch(output(tree), /Saved public finding/);
    assert.match(output(tree), /no longer public|published version changed/);
    assert.ok(requests.every((r) => r.init.method === 'GET'));
  } finally {
    if (tree) await act(async () => tree.unmount());
    globalThis.window = previousWindow;
    globalThis.EventSource = previousEvents;
  }
});
