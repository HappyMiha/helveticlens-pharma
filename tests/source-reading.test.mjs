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

const {
  sourceReference,
  sourceCount,
  sourceTimestamp,
  sourceFingerprint,
} = require(resolve('lib/source-reading.ts'));
const { SourceMetadata, SourcePreview, SourceCard } = require(
  resolve('components/source-card.tsx'),
);

test('source references preserve exact context and reject unsafe or credential-bearing links', () => {
  assert.deepEqual(
    sourceReference('https://example.org:8443/law?q=one#art_1'),
    {
      href: 'https://example.org:8443/law?q=one#art_1',
      origin: 'example.org:8443',
    },
  );
  for (const value of [
    'javascript:alert(1)',
    '//example.org',
    'https://user:secret@example.org/',
    'https://example.org\\bad',
    'https://example.org/\npath',
    '',
    null,
  ])
    assert.equal(sourceReference(value, true), null);
  assert.equal(sourceReference('http://example.org/law'), null);
  assert.equal(
    sourceReference('http://example.org/law', true).href,
    'http://example.org/law',
  );
});
test('unknown counts cannot become measured zero or fabricated totals', () => {
  assert.equal(sourceCount(0), 0);
  assert.equal(sourceCount(10001), 10001);
  for (const value of [
    null,
    undefined,
    '',
    '7',
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.equal(sourceCount(value), null);
});
test('only complete recorded SHA-256 values are fingerprint labels', () => {
  assert.equal(sourceFingerprint('AB'.repeat(32)), 'ab'.repeat(32));
  for (const value of [
    null,
    undefined,
    '',
    'a'.repeat(63),
    'x'.repeat(64),
    '<script>not-a-fingerprint</script>',
  ])
    assert.equal(sourceFingerprint(value), null);
});
test('capture dates require an explicit parseable timestamp', () => {
  for (const value of [
    '2026-09-28T07:00:00Z',
    '2026-09-28T09:00:00.123456+02:00',
  ])
    assert.equal(sourceTimestamp(value), value);
  for (const value of [
    undefined,
    null,
    '',
    'yesterday',
    '2026-09-28',
    '2026-09-28T07:00:00',
    '2026-13-28T07:00:00Z',
    '<script>',
  ])
    assert.equal(sourceTimestamp(value), null);
});

const source = {
  id: 'source-one',
  kind: 'web',
  title: 'Saved <source>',
  url: 'https://example.org/law',
  created_at: '2026-09-28T07:00:00Z',
  sha256: 'ab'.repeat(32),
  original: { author: 'Chosen <author>' },
  snapshot: {
    scope: 'Retained excerpts only',
    excerpts: [
      {
        passage: 'p1',
        text: 'Original <script>quoted()</script>\nSecond line',
      },
      { passage: 'p2', text: 'Another quotation' },
    ],
  },
};
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
test('product metadata separates capture time and unknown publication facts, tolerating malformed capture time', () => {
  const html = render(SourceMetadata, { source });
  assert.match(html, /dateTime="2026-09-28T07:00:00Z"/);
  assert.match(html, /Publication date<\/dt><dd>Not established/);
  assert.match(html, /Primary \/ secondary not established/);
  assert.match(html, /Chosen &lt;author&gt;/);
  const unknown = render(SourceMetadata, {
    source: {
      ...source,
      url: 'https://user:secret@example.org',
      created_at: 'bad',
    },
  });
  assert.match(unknown, /Captured<\/dt><dd>Not established/);
  assert.doesNotMatch(unknown, /<time|secret/);
});
test('retained source reader preserves exact quotations, capture identity and honest empty limits', () => {
  const html = render(SourcePreview, { source });
  assert.match(html, /Original &lt;script&gt;quoted/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /p1/);
  assert.match(html, /source-one/);
  assert.ok(html.includes(source.sha256));
  assert.match(html, /original source may have changed/);
  const empty = render(SourcePreview, {
    source: { ...source, sha256: 'bad', snapshot: { scope: '', excerpts: [] } },
  });
  assert.match(empty, /No excerpts were retained/);
  assert.match(empty, /Not available in this record/);
  assert.doesNotMatch(empty, /data-source-fingerprint/);
});
test('source cards expose exact retained counts and unique claim use, preserving source and claim destinations', () => {
  const value = {
    evidence: [
      { source_id: 'source-one', claim_id: 'c1', relation: 'SUPPORTS' },
      { source_id: 'source-one', claim_id: 'c1', relation: 'CONTRADICTS' },
      { source_id: 'elsewhere', claim_id: 'c2', relation: 'SUPPORTS' },
    ],
  };
  const html = render(SourceCard, { source, value });
  assert.match(html, /retained excerpts<\/dt><dd>2<\/dd>/);
  assert.match(html, /claim uses this source<\/dt><dd>1<\/dd>/);
  assert.match(html, /1 claim with contradicting evidence/);
  assert.match(html, /href="#claim-c1"/);
  assert.doesNotMatch(html, /href="#claim-c2"/);
  assert.match(html, /id="source-source-one"/);
  assert.match(html, /href="https:\/\/example.org\/law"/);
  assert.match(html, /rel="noopener noreferrer nofollow ugc"/);
  const unsafe = render(SourceCard, {
    source: { ...source, url: 'http://example.org/' },
    value,
  });
  assert.doesNotMatch(unsafe, /href="http:/);
});

for (const idPrefix of ['source', 'dossier-original']) test(`earlier capture links identify a card in the ${idPrefix} reader`, () => {
  const duplicate = { ...source, id: 'duplicate', snapshot: { ...source.snapshot, duplicate_of: source.id } };
  const value = { sources: [source, duplicate], evidence: [] };
  const html = renderToStaticMarkup(React.createElement('main', null,
    value.sources.map((item) => React.createElement(SourceCard, { key: item.id, source: item, value, idPrefix })),
  ));
  assert.match(html, new RegExp(`id="${idPrefix}-${source.id}"`));
  assert.match(html, new RegExp(`href="#${idPrefix}-${source.id}"`));
  assert.match(html, /same document bytes as an earlier source/);
  assert.match(html, /Original &lt;script&gt;quoted/);
  assert.ok(html.includes(source.sha256));
  if (idPrefix !== 'source') assert.doesNotMatch(html, /href="#source-/);
});

test('missing and self-referential earlier captures keep provenance without a broken jump', () => {
  for (const duplicate_of of ['unavailable', source.id]) {
    const duplicate = { ...source, snapshot: { ...source.snapshot, duplicate_of } };
    const html = render(SourceCard, { source: duplicate, value: { sources: [duplicate], evidence: [] } });
    assert.doesNotMatch(html, /Read the earlier capture|href="#source-/);
    assert.match(html, /earlier capture is not available in this view/);
    assert.match(html, /same document bytes/);
    assert.match(html, /Original &lt;script&gt;quoted/);
  }
});
