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

const { SavedVersionContext } = require(
  resolve('components/saved-version-context.tsx'),
);
const { documentSourceLink } = require(resolve('lib/version-context.ts'));
const version = {
  id: 'source-version-full-0123456789',
  created_at: '2026-09-28T07:00:00Z',
  declared_date: '2025-01-01',
  date_provenance: 'user_supplied',
  evidence_revision: 7,
  origin: 'upload',
  source_url: 'https://example.org/document',
  filename: 'retained.pdf',
  content_type: 'application/pdf',
  content_hash: 'ab'.repeat(32),
  characters: 12000,
  passage_count: 21,
  synthetic: false,
  selection_provenance: {
    scope: null,
    official_version_date: null,
    articles: [],
  },
};
const render = (value) =>
  renderToStaticMarkup(
    React.createElement(SavedVersionContext, { version: value }),
  );
const escaped = (value) =>
  renderToStaticMarkup(React.createElement(React.Fragment, null, value));
test('saved document context distinguishes retained identity, counts, capture time and declared document provenance', () => {
  const html = render(version);
  for (const value of [
    version.id,
    version.filename,
    version.content_type,
    version.content_hash,
    '2025-01-01',
    'user_supplied',
    'example.org',
    'upload',
    (12000).toLocaleString('en-CH'),
  ])
    assert.ok(html.includes(escaped(value)), value);
  assert.match(html, /dateTime="2026-09-28T07:00:00Z"/);
  assert.match(html, /Evidence revision<\/dt><dd>7<\/dd>/);
  assert.match(html, /saved passages<\/dt><dd>21<\/dd>/);
  assert.match(
    html,
    /do not establish that the complete original document was captured/,
  );
  assert.match(
    html,
    /Capture time does not establish publication or legal effect/,
  );
});
test('unavailable capture metadata stays unknown without formatting an invalid date or leaking URL credentials', () => {
  const html = render({
    ...version,
    created_at: 'bad',
    source_url: 'https://user:secret@example.org',
    characters: undefined,
    passage_count: null,
    content_hash: 'bad',
    evidence_revision: undefined,
  });
  assert.match(html, /Not established/);
  assert.match(html, /Not recorded/);
  assert.match(html, /Origin not established/);
  assert.match(html, /Not available in this record/);
  assert.doesNotMatch(
    html,
    /<time|secret|data-saved-version-fingerprint|>0<\/dd>/,
  );
});
test('measured zero and empty original-file metadata remain distinct in the actual reader', () => {
  const html = render({
    ...version,
    characters: 0,
    passage_count: 0,
    filename: '',
    content_type: 'unknown',
    declared_date: null,
    date_provenance: null,
    origin: 'live',
  });
  assert.equal((html.match(/>0<\/dd>/g) || []).length, 2);
  assert.match(html, /File name<\/dt><dd>Not recorded/);
  assert.match(html, /Format<\/dt><dd>Not recorded/);
  assert.match(html, /Page capture/);
  assert.doesNotMatch(html, /user_supplied|undefined/);
});
test('synthetic and selected-article captures retain their limits, exact dates and untrusted original labels', () => {
  const html = render({
    ...version,
    synthetic: true,
    filename: '<script>file</script>',
    selection_provenance: {
      scope: 'selected_articles',
      official_version_date: '2024-01-01',
      articles: [{ number: '1', heading: '<img src=x>' }],
    },
  });
  assert.match(html, /Synthetic saved version/);
  assert.match(html, /not a verified live-source capture/);
  assert.match(html, /selected parts of the source/);
  assert.match(html, /2024-01-01/);
  assert.match(html, /Art\. 1 · &lt;img/);
  assert.match(html, /&lt;script&gt;file/);
  assert.doesNotMatch(html, /<script>|<img/);
});
test('source actions preserve safe recorded HTTP(S) links and label the monitored-page fallback separately', () => {
  assert.deepEqual(
    documentSourceLink(
      'https://example.org/exact?x=1#part',
      'https://other.test',
    ),
    {
      href: 'https://example.org/exact?x=1#part',
      origin: 'example.org',
      recorded: true,
    },
  );
  assert.equal(
    documentSourceLink('http://example.org/legacy', null).recorded,
    true,
  );
  assert.deepEqual(documentSourceLink(null, 'https://example.org/watch'), {
    href: 'https://example.org/watch',
    origin: 'example.org',
    recorded: false,
  });
  for (const url of [
    'javascript:alert(1)',
    '//example.org/',
    'https://user:secret@example.org/',
    'https://example.org/\npath',
    'https://example.org\\path',
  ])
    assert.equal(documentSourceLink(url, 'https://safe.test'), null);
  assert.equal(documentSourceLink(null, 'javascript:alert(1)'), null);
  assert.equal(documentSourceLink(null, null), null);
});
