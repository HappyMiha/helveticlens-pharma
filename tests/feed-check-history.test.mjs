import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';

// Exercise actual server rendering without a browser or live account. Type
// checking remains the separate full-project gate; this loader only transpiles.
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
  Module._load = originalLoad;
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct;
  Module._resolveFilename = originalResolve;
  if (originalCss) Module._extensions['.css'] = originalCss;
  else delete Module._extensions['.css'];
  if (originalTs) Module._extensions['.ts'] = originalTs;
  else delete Module._extensions['.ts'];
  if (originalTsx) Module._extensions['.tsx'] = originalTsx;
  else delete Module._extensions['.tsx'];
});

const { FeedCheckHistory, FeedChecksReading } = require(resolve('components/feed-check-history.tsx'));
const { currentFeedChecks, feedChecksPath } = require(resolve('lib/feed-check-history.ts'));
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
const run = { id: 'run', status: 'persisted', created_at: '2026-09-30T10:00:00Z', started_at: null, finished_at: null, reported_counts: { new: 0, changed: 0, failed: 1 }, explanation: 'Item errors may include earlier attempts, not only unresolved failures.' };
function value(extra = {}) {
  return { schema_id: 'feed-check-history/v1', dossier_id: 'dossier', profile_status: 'active', topics: [], pack: { id: 'pack', definition_state: 'active', subscription_enabled: true, subscription_state: 'active' }, source: { connector: 'connector', stream: 'stream', enabled: true }, items: [run], offset: 0, page_size: 10, total: 11, next_offset: 10, as_of: '2026-09-30T10:10:00Z', scope: 'Shared collection; not proof that every source was read for this question.', ...extra };
}
const props = { dossierId: 'dossier', packId: 'pack', connector: 'connector', stream: 'stream' };
test('shared collections are on demand and remain separate from dossier-level source checks', () => {
  const html = render(FeedCheckHistory, props);
  assert.match(html, /Collection history/);
  assert.doesNotMatch(html, /<details[^>]*open|Reading saved collections|Collection completed|Reported feed events/);
});
test('real reading distinguishes retained errors, unknown timestamps and zero reported counts', () => {
  const html = render(FeedChecksReading, { value: value() });
  for (const phrase of ['Collection completed', 'earlier attempts', 'start time not recorded', 'completion time not recorded', 'Reported feed events: 0 new', 'Recorded item errors: 1', 'not proof']) assert.ok(html.includes(phrase), phrase);
  assert.doesNotMatch(html, /No relevant changes|Sources unchanged|All sources checked/);
});
test('draft, disconnected, inactive and missing history stay explicit; supplied text is escaped', () => {
  const html = render(FeedChecksReading, { value: value({ profile_status: 'draft', pack: { id: 'pack', definition_state: 'inactive', subscription_enabled: false }, source: { enabled: false }, items: [] }) });
  for (const phrase of ['Draft selection', 'inactive in the source catalogue', 'not currently connected', 'Automatic collection is currently off', 'No collection runs']) assert.ok(html.includes(phrase), phrase);
  const text = render(FeedChecksReading, { value: value({ items: [{ ...run, status: 'new_unknown', explanation: '<script>Untrusted', reported_counts: null }] }) });
  assert.match(text, /outcome not established/);
  assert.match(text, /&lt;script&gt;Untrusted/);
  assert.doesNotMatch(text, /<script>|Reported feed events/);
});
test('errors, changed source selection and page mismatches reject retained history', () => {
  const data = value();
  assert.equal(currentFeedChecks(data, '', 'dossier', 'pack', 'connector', 'stream', 0), data);
  for (const args of [['denied', 'dossier', 'pack', 'connector', 'stream', 0], ['', 'other', 'pack', 'connector', 'stream', 0], ['', 'dossier', 'other', 'connector', 'stream', 0], ['', 'dossier', 'pack', 'other', 'stream', 0], ['', 'dossier', 'pack', 'connector', 'other', 0], ['', 'dossier', 'pack', 'connector', 'stream', 10]]) assert.equal(currentFeedChecks(data, ...args), null);
  assert.equal(currentFeedChecks({ ...data, schema_id: 'future/v2' }, '', 'dossier', 'pack', 'connector', 'stream', 0), null);
  const path = feedChecksPath('legal', 'dossier', 'pack', 'connector', 'space/stream', 10, data.as_of);
  const params = new URL('https://example.invalid' + path).searchParams;
  assert.equal(params.get('stream'), 'space/stream'); assert.equal(params.get('as_of'), data.as_of);
});
test('actual collection reader pages, refreshes, clears failures, retries and respects session reset', async () => {
  globalThis.window = new EventTarget();
  const requests = [];
  globalThis.fetch = (url, init) => new Promise((resolve) => requests.push({ url, init, resolve }));
  let tree;
  const originalError = console.error, warnings = [];
  console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) warnings.push(args); };
  const button = (label) => tree.root.findAllByType('button').find((n) => n.props.children === label);
  const respond = (body, status = 200) => act(async () => requests.at(-1).resolve(Response.json(body, { status })));
  try {
    await act(async () => { tree = create(React.createElement(FeedCheckHistory, props)); });
    assert.equal(requests.length, 0);
    await act(async () => tree.root.findByType('details').props.onToggle({ currentTarget: { open: true } }));
    assert.equal(requests.length, 1);
    await respond(value());
    assert.match(JSON.stringify(tree.toJSON()), /Collection completed/);
    await act(async () => button('Older collections').props.onClick());
    const params = new URL('https://example.invalid' + requests.at(-1).url).searchParams;
    assert.equal(params.get('offset'), '10'); assert.equal(params.get('as_of'), value().as_of);
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /Collection completed/);
    await respond(value({ offset: 10, items: [], next_offset: null }));
    assert.equal(button('Older collections').props.disabled, true);
    await act(async () => button('Refresh collection history').props.onClick());
    assert.equal(new URL('https://example.invalid' + requests.at(-1).url).searchParams.has('as_of'), false);
    await respond({ detail: 'PRIVATE raw failure' }, 503);
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /Collection completed|PRIVATE raw/);
    await act(async () => { button('Retry collections').props.onClick(); });
    await respond(value());
    assert.match(JSON.stringify(tree.toJSON()), /Collection completed/);
    await act(async () => window.dispatchEvent(new Event('helvetic-session-changed')));
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /Collection completed/);
    await respond({ detail: 'Access ended' }, 401);
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /Collection completed/);
    assert.ok(requests.every(({ init }) => init.method === 'GET'));
    assert.deepEqual(warnings, []);
  } finally { if (tree) await act(async () => tree.unmount()); console.error = originalError; }
});
