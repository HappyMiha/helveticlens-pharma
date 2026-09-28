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

const { savedPagePosition } = require(resolve('lib/saved-comparisons.ts'));
const { SavedPageComparison } = require(
  resolve('components/saved-page-comparison.tsx'),
);
const page = {
  document_id: 'document',
  version_id: 'new-version',
  revision: 3,
  content_hash: 'ab'.repeat(32),
  before_characters: 12000,
  after_characters: 15000,
  previous: {
    version_id: 'old-version',
    revision: 2,
    captured_at: '2026-09-27T07:00:00Z',
    content_hash: 'cd'.repeat(32),
  },
  first_difference: 300,
  excerpt_start: 120,
  before: 'Earlier <script>quoted()</script>\nline',
  after: 'New & exact',
  partial: true,
  preview_partial: true,
};
const render = (props) =>
  renderToStaticMarkup(
    React.createElement(SavedPageComparison, {
      page,
      capturedAt: '2026-09-28T07:00:00Z',
      ...props,
    }),
  );
test('saved-page positions pin each side to its own retained version and revision', () => {
  assert.deepEqual(savedPagePosition(page, 'before'), {
    id: 'old-version',
    revision: 2,
    offset: 0,
  });
  assert.deepEqual(savedPagePosition(page, 'after'), {
    id: 'new-version',
    revision: 3,
    offset: 0,
  });
  for (const revision of [
    0,
    -1,
    1.5,
    undefined,
    null,
    '2',
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(savedPagePosition({ ...page, revision }, 'after'), null);
    assert.equal(
      savedPagePosition(
        { ...page, previous: { ...page.previous, revision } },
        'before',
      ),
      null,
    );
  }
  for (const version_id of ['', null, undefined, 'x'.repeat(201)])
    assert.equal(savedPagePosition({ ...page, version_id }, 'after'), null);
});
test('actual reader shows full-text counts, complete capture identity and bounded escaped quotations', () => {
  const html = render();
  assert.match(html, /character 301/);
  assert.match(html, /more changes may appear elsewhere/);
  assert.match(html, /Earlier &lt;script&gt;quoted/);
  assert.match(html, /New &amp; exact/);
  assert.doesNotMatch(html, /<script>/);
  assert.ok(
    html.includes(
      renderToStaticMarkup(
        React.createElement(
          React.Fragment,
          null,
          (12000).toLocaleString('en-CH'),
        ),
      ),
    ),
  );
  assert.ok(
    html.includes(
      renderToStaticMarkup(
        React.createElement(
          React.Fragment,
          null,
          (15000).toLocaleString('en-CH'),
        ),
      ),
    ),
  );
  for (const value of [
    'old-version',
    'new-version',
    '2026-09-27T07:00:00Z',
    '2026-09-28T07:00:00Z',
    page.content_hash,
    page.previous.content_hash,
  ])
    assert.ok(html.includes(value));
  assert.match(
    html,
    /Capture times are separate from document publication or effective dates/,
  );
  assert.match(
    html,
    /A text difference does not establish that a finding changed/,
  );
  assert.doesNotMatch(html, /Read earlier version|Read new version/);
});
test('full and partial saved previews keep distinct limits without promising missing text', () => {
  assert.match(
    render({ page: { ...page, partial: false, preview_partial: false } }),
    /Both saved texts are shown in full/,
  );
  for (const partial of [
    { partial: true, preview_partial: false },
    { partial: false, preview_partial: true },
  ]) {
    const html = render({ page: { ...page, ...partial } });
    assert.match(html, /partial view/);
    assert.doesNotMatch(html, /Both saved texts are shown in full/);
  }
});
test('missing metadata stays unknown, measured zero stays zero, and malformed fingerprints and dates are hidden', () => {
  const html = render({
    page: {
      ...page,
      content_hash: 'invalid',
      after_characters: 0,
      before_characters: undefined,
      first_difference: undefined,
      previous: { ...page.previous, captured_at: 'bad', content_hash: null },
    },
    capturedAt: 'bad',
  });
  assert.match(html, /Not recorded/);
  assert.match(html, />0<\/dd>/);
  assert.match(html, /Not established/);
  assert.match(html, /Not available in this record/);
  assert.doesNotMatch(
    html,
    /<time|data-comparison-fingerprint|at character|invalid|>bad</,
  );
});
function elements(node) {
  if (!React.isValidElement(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
test('real reader actions open the exact earlier/new revision without substituting current versions', () => {
  const calls = [];
  const tree = SavedPageComparison({
    page,
    capturedAt: '2026-09-28T07:00:00Z',
    onRead: (value) => calls.push(value),
  });
  const actions = elements(tree).filter(
    (node) => typeof node.props.onClick === 'function',
  );
  assert.deepEqual(
    actions.map((node) => node.props.children),
    ['Read earlier version', 'Read new version'],
  );
  actions.forEach((node) => node.props.onClick());
  assert.deepEqual(calls, [
    { id: 'old-version', revision: 2, offset: 0 },
    { id: 'new-version', revision: 3, offset: 0 },
  ]);
  const unavailable = render({
    page: { ...page, revision: 0, previous: { ...page.previous, revision: 0 } },
    onRead: () => {
      throw new Error('Invalid version opened');
    },
  });
  assert.doesNotMatch(unavailable, /Read earlier version|Read new version/);
});
