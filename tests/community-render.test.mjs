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
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(
    this,
    name.startsWith('@/') ? resolve(name.slice(2)) : name,
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
const { PublicDiscussion } = require(
  resolve('components/public-discussion.tsx'),
);
const { contributionDraft } = require(resolve('lib/community.ts'));
after(() => {
  Module._resolveFilename = originalResolve;
  if (originalTs) Module._extensions['.ts'] = originalTs;
  else delete Module._extensions['.ts'];
  if (originalTsx) Module._extensions['.tsx'] = originalTsx;
  else delete Module._extensions['.tsx'];
});

const base = {
  publicationId: '11111111-1111-1111-1111-111111111111',
  publicationRevision: 1,
};
const page = {
  items: [],
  total: 0,
  offset: 0,
  page_size: 20,
  publication_revision: 1,
  can_post: false,
  can_moderate: false,
};

test('anonymous SSR contains the discussion and honest empty state without account controls', () => {
  const html = renderToStaticMarkup(
    React.createElement(PublicDiscussion, { ...base, initial: page }),
  );
  assert.match(html, /Public discussion/);
  assert.match(html, /No public contributions yet/);
  assert.doesNotMatch(
    html,
    /Edit my contribution|Remove my contribution|Hide from discussion|Signed in as/,
  );
});

test('anonymous SSR escapes contributed text and keeps source links isolated', () => {
  const item = {
    id: '22222222-2222-2222-2222-222222222222',
    revision: 1,
    publication_revision: 1,
    author_label: '<script>author()</script>',
    body: '<img src=x onerror=alert(1)>',
    sources: [
      {
        title: '<script>source()</script>',
        url: 'https://www.fedlex.admin.ch/',
      },
    ],
    created_at: '2026-09-27T00:00:00Z',
    updated_at: '2026-09-27T00:00:00Z',
  };
  const html = renderToStaticMarkup(
    React.createElement(PublicDiscussion, {
      ...base,
      initial: { ...page, items: [item], total: 1 },
    }),
  );
  assert.match(html, /&lt;script&gt;author/);
  assert.match(html, /&lt;img src=x/);
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /rel="noopener noreferrer nofollow ugc"/);
  assert.match(html, /target="_blank"/);
});

test('new contributions never infer a public name or copy hidden account metadata', () => {
  assert.deepEqual(contributionDraft(), {
    author_label: '',
    body: '',
    sources: [],
  });
  const draft = contributionDraft({
    author_label: 'Chosen public name',
    body: 'Public text',
    sources: [
      {
        title: 'Source',
        url: 'https://www.fedlex.admin.ch/',
        secret: 'PRIVATE',
      },
    ],
    email: 'PRIVATE',
    moderation_reason: 'PRIVATE',
    organization_id: 'PRIVATE',
  });
  assert.equal(JSON.stringify(draft).includes('PRIVATE'), false);
});
