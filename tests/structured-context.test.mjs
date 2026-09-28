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

const { ContextSummary, SubjectFields, SubjectHistory } = require(
  resolve('components/structured-context.tsx'),
);
const { contextDraft, contextValues } = require(
  resolve('lib/structured-context.ts'),
);
const fields = [
  {
    key: 'product_names',
    label: 'Product names',
    kind: 'list',
    hint: 'One value per line.',
  },
  {
    key: 'active_substances',
    label: 'Active substances',
    kind: 'list',
    hint: 'One value per line.',
  },
  {
    key: 'countries',
    label: 'Countries / markets',
    kind: 'list',
    hint: 'One value per line.',
  },
];
const context = {
  domain: 'PHARMA',
  pack_id: 'PharmaPack',
  pack_version: '1.1.0',
  schema_id: 'pharma-context/v1',
  revision: 2,
  saved: true,
  updated_at: '2026-09-28T12:00:00Z',
  fields,
  values: {
    product_names: ['Brand A <script>'],
    active_substances: ['Substance A'],
    countries: ['Switzerland'],
  },
};
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));

test('recorded subject separates product and substance, escapes names and does not imply source verification', () => {
  const html = render(ContextSummary, { value: context });
  assert.match(html, /user-provided context/);
  assert.match(html, /Product names<\/dt><dd><ul><li>Brand A &lt;script&gt;/);
  assert.match(html, /Active substances<\/dt><dd><ul><li>Substance A/);
  assert.match(html, /Countries \/ markets/);
  assert.doesNotMatch(html, /<script>|confidence|verified source/i);
  const empty = render(ContextSummary, { value: { ...context, values: {} } });
  assert.match(empty, /No subject details recorded/);
  assert.doesNotMatch(empty, /<dl/);
});

test('one shared editor renders optional labelled fields and respects read-only state', () => {
  const html = render(SubjectFields, {
    value: context,
    draft: contextDraft(context),
    disabled: true,
    onChange() {},
  });
  assert.equal((html.match(/<textarea/g) || []).length, 3);
  assert.equal((html.match(/disabled=""/g) || []).length, 3);
  assert.doesNotMatch(html, /required=/);
  assert.match(html, /Product names/);
  assert.match(html, /Substance A/);
  const legal = {
    ...context,
    fields: [
      {
        key: 'jurisdictions',
        label: 'Jurisdictions',
        kind: 'list',
        hint: 'One per line.',
      },
      {
        key: 'procedural_stage',
        label: 'Procedural stage',
        kind: 'text',
        hint: 'Optional.',
      },
    ],
    values: { jurisdictions: ['CH'], procedural_stage: 'Recorded stage' },
  };
  const legalHtml = render(SubjectFields, {
    value: legal,
    draft: contextDraft(legal),
    disabled: false,
    onChange() {},
  });
  assert.match(legalHtml, /Jurisdictions/);
  assert.match(legalHtml, /value="Recorded stage"/);
  assert.doesNotMatch(legalHtml, /Product names|disabled=""/);
});

test('subject form round-trips separate values and preserves exact names without inferring aliases', () => {
  const draft = contextDraft(context);
  assert.deepEqual(contextValues(fields, draft), context.values);
  draft.product_names =
    ' Brand A, presentation 1\r\nBrand A, presentation 1\nbrand a\n';
  assert.deepEqual(contextValues(fields, draft).product_names, [
    'Brand A, presentation 1',
    'brand a',
  ]);
  assert.deepEqual(contextValues(fields, {}).active_substances, []);
  assert.deepEqual(
    contextValues(fields, {
      ...draft,
      rogue: 'Never submit an unregistered field',
    }),
    contextValues(fields, draft),
  );
});

test('invalid or oversized subject input is stopped before a save request', () => {
  assert.throws(
    () => contextValues(fields, { product_names: 'x'.repeat(241) }),
    /240/,
  );
  assert.throws(
    () =>
      contextValues(fields, {
        product_names: Array.from({ length: 31 }, (_, i) => String(i)).join(
          '\n',
        ),
      }),
    /30/,
  );
  const dates = [
    { key: 'relevant_dates', label: 'Relevant dates', kind: 'dates' },
  ];
  for (const value of ['2026-02-30', '20260928', '0000-01-01'])
    assert.throws(
      () => contextValues(dates, { relevant_dates: value }),
      /real dates/,
    );
  assert.deepEqual(
    contextValues(dates, { relevant_dates: '2024-02-29\n2026-09-28' })
      .relevant_dates,
    ['2024-02-29', '2026-09-28'],
  );
  const large = Array.from({ length: 30 }, (_, i) =>
    String(i).padStart(240, 'x'),
  ).join('\n');
  assert.throws(
    () =>
      contextValues(fields, { product_names: large, active_substances: large }),
    /12,000/,
  );
});

test('subject history retains authorship and distinct before/after values, including unavailable formats', () => {
  const entry = {
    id: 'change-1',
    kind: 'domain_context',
    author: 'Ada <script>',
    created_at: '2026-09-28T12:00:00Z',
    data: {
      revision: 3,
      before: {
        schema_id: context.schema_id,
        values: { product_names: ['Previous brand'] },
      },
      after: {
        schema_id: context.schema_id,
        values: { product_names: ['Updated brand'] },
      },
    },
  };
  const html = render(SubjectHistory, { value: context, entries: [entry] });
  assert.match(html, /Ada &lt;script&gt;/);
  assert.match(html, /Revision 3/);
  assert.match(html, /Before/);
  assert.match(html, /Previous brand/);
  assert.match(html, /After/);
  assert.match(html, /Updated brand/);
  assert.match(html, /<details class="dossier-subject-history">/);
  const unknown = render(SubjectHistory, {
    value: context,
    entries: [
      {
        ...entry,
        data: {
          ...entry.data,
          after: { ...entry.data.after, schema_id: 'future' },
        },
      },
    ],
  });
  assert.match(unknown, /different context format/);
  assert.doesNotMatch(unknown, /Updated brand/);
});
