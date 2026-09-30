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
Module._load = function (name, parent, ...args) {
  if (parent?.filename.endsWith('/components/page-check-history.tsx') && name === './document-history')
    return { DocumentHistory: (props) => React.createElement('aside', { 'data-version': props.initialPage.id, 'data-revision': props.initialPage.revision }) };
  return originalLoad.call(this, name, parent, ...args);
};
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

const { PageCheckHistory, PageChecksReading } = require(resolve('components/page-check-history.tsx'));
const { currentPageChecks, pageChecksPath } = require(resolve('lib/page-check-history.ts'));
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
const capture = { id: 'version', evidence_revision: 2, label: 'Captured version', created_at: '2026-09-30T10:00:00Z' };
const item = { id: 'check', created_at: '2026-09-30T10:00:00Z', finished_at: null, outcome: 'changed', analysis_status: 'failed', versions: [capture], research: null, limitation: null };
function value(extra = {}) {
  return { schema_id: 'page-check-history/v1', dossier_id: 'dossier', document: { id: 'page' }, items: [item], offset: 0, page_size: 10, total: 11, next_offset: 10, as_of: '2026-09-30T10:10:00Z', scope: 'Retained workspace checks, not a dossier-wide scan.', ...extra };
}
const props = { dossierId: 'dossier', documentId: 'page', name: 'Fictional source', onInvestigation() {} };
test('history is collapsed and does not request data on the initial source reading', () => {
  const html = render(PageCheckHistory, props);
  assert.match(html, /History of checks/);
  assert.doesNotMatch(html, /<details[^>]*open|Reading saved checks|No separate checks|Page text changed/);
});
test('capture, analysis and related research remain distinct and untrusted passages are escaped', () => {
  const html = render(PageChecksReading, { value: value({ items: [{ ...item, research: { state: 'completed', investigation_id: 'run', finding: { statement: '<script>Fictional finding', evidence: { quote: '<script>Source passage', source: { title: 'Example' }, locator: 'p1' } } } }] }), onVersion() {}, onInvestigation() {} });
  for (const phrase of ['Page text changed', 'Source was read; analysis failed', 'completion time not recorded', 'Dossier research: completed', 'AI finding', 'Open related research', '&lt;script&gt;Source passage']) assert.ok(html.includes(phrase), phrase);
  assert.doesNotMatch(html, /<script>/);
});
test('missing checks, unknown analysis and unavailable evidence do not claim success', () => {
  assert.match(render(PageChecksReading, { value: value({ items: [] }) }), /does not establish a repeated check/);
  const html = render(PageChecksReading, { value: value({ items: [{ ...item, analysis_status: 'new_unknown_state' }, { ...item, id: 'failure', outcome: 'evidence_unavailable', analysis_status: 'succeeded', versions: [] }] }) });
  assert.match(html, /Analysis status not established/);
  assert.match(html, /Supporting versions unavailable/);
  assert.doesNotMatch(html, /Analysis completed/);
});
test('failed, mismatched, older-page and future-contract responses cannot render retained history', () => {
  const saved = value();
  assert.equal(currentPageChecks(saved, '', 'dossier', 'page', 0), saved);
  for (const [data, error, dossier, page, offset] of [[saved, 'denied', 'dossier', 'page', 0], [saved, '', 'other', 'page', 0], [saved, '', 'dossier', 'other', 0], [saved, '', 'dossier', 'page', 10], [{ ...saved, schema_id: 'page-check-history/v2' }, '', 'dossier', 'page', 0]]) assert.equal(currentPageChecks(data, error, dossier, page, offset), null);
  const path = pageChecksPath('dossier', 'page', 'legal', 10, saved.as_of);
  assert.equal(new URL('https://example.invalid' + path).searchParams.get('as_of'), saved.as_of);
});
test('actual history opens on demand, pages with a fixed cutoff, navigates to exact revision and clears on failure/session change', async () => {
  globalThis.window = new EventTarget();
  const requests = [];
  globalThis.fetch = (url, init) => new Promise((resolve) => requests.push({ url, init, resolve }));
  let tree;
  const opened = [];
  const originalError = console.error;
  const warnings = [];
  console.error = (...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) warnings.push(args); };
  const button = (label) => tree.root.findAllByType('button').find((n) => n.props.children === label);
  const resolveLast = async (body, status = 200) => act(async () => requests.at(-1).resolve(Response.json(body, { status })));
  try {
    await act(async () => { tree = create(React.createElement(PageCheckHistory, { ...props, onInvestigation: (id) => opened.push(id) })); });
    assert.equal(requests.length, 0);
    await act(async () => tree.root.findByType('details').props.onToggle({ currentTarget: { open: true } }));
    assert.equal(requests.length, 1);
    await resolveLast(value({ items: [{ ...item, research: { state: 'completed', investigation_id: 'run', finding: null } }] }));
    await act(async () => button('Open related research').props.onClick());
    assert.deepEqual(opened, ['run']);
    const versionButton = tree.root.findAllByType('button').find((n) => Array.isArray(n.props.children) && n.props.children[0] === 'Captured version');
    await act(async () => versionButton.props.onClick());
    assert.equal(tree.root.findByType('aside').props['data-version'], 'version');
    assert.equal(tree.root.findByType('aside').props['data-revision'], 2);
    await act(async () => button('Older checks').props.onClick());
    const url = new URL('https://example.invalid' + requests.at(-1).url);
    assert.equal(url.searchParams.get('offset'), '10');
    assert.equal(url.searchParams.get('as_of'), value().as_of);
    assert.equal(tree.root.findAllByType('aside').length, 0);
    await resolveLast(value({ offset: 10, items: [], next_offset: null }));
    assert.equal(button('Older checks').props.disabled, true);
    await act(async () => button('Newer checks').props.onClick());
    await resolveLast(value());
    await act(async () => button('Refresh check history').props.onClick());
    assert.equal(new URL('https://example.invalid' + requests.at(-1).url).searchParams.has('as_of'), false);
    await resolveLast({ detail: 'PRIVATE upstream error' }, 503);
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /Page text changed|PRIVATE upstream|data-version/);
    await act(async () => { button('Retry history').props.onClick(); });
    await resolveLast(value());
    assert.match(JSON.stringify(tree.toJSON()), /Page text changed/);
    await act(async () => window.dispatchEvent(new Event('helvetic-session-changed')));
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /Page text changed|data-version/);
    await resolveLast({ detail: 'Session ended' }, 401);
    assert.doesNotMatch(JSON.stringify(tree.toJSON()), /Page text changed/);
    assert.ok(requests.every(({ init }) => init.method === 'GET'));
    assert.deepEqual(warnings, []);
  } finally { if (tree) await act(async () => tree.unmount()); console.error = originalError; }
});
