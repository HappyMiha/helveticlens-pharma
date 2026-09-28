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
  TemplateGuidance,
  TemplateOptions,
  TemplateHistory,
  DossierTemplateSection,
} = require(resolve('components/dossier-template.tsx'));
const { templateKey, templateReference, templateStarter } = require(
  resolve('lib/dossier-templates.ts'),
);
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
const template = {
  schema_id: 'dossier-template/v1',
  id: 'market-access',
  version: '1.0.0',
  domain: 'PHARMA',
  pack_id: 'PharmaPack',
  pack_version: '1.2.0',
  context_schema_id: 'pharma-context/v1',
  title: 'Market Access <script>',
  description: 'A question, not a finding.',
  sector: 'Market access',
  goal: 'Which evidence needs review?',
  context_fields: [
    { key: 'product_names', label: 'Product names' },
    { key: 'active_substances', label: 'Active substances' },
  ],
  questions: ['Which product?', 'Which market?'],
};

test('template guidance is versioned, escaped and separate from source findings', () => {
  const html = render(TemplateGuidance, { value: template });
  assert.match(html, /Research template/);
  assert.match(html, /Market Access &lt;script&gt;/);
  assert.match(html, /version 1.0.0/);
  assert.match(
    html,
    /<details><summary>Suggested context &amp; research questions/,
  );
  assert.match(html, /Product names · Active substances/);
  assert.match(html, /<li>Which product/);
  assert.match(html, /Evidence and source checks are recorded separately/);
  assert.doesNotMatch(html, /<script>|confidence|verified fact/);
});

test('optional template selector retains unavailable saved versions and disables read-only input', () => {
  const html = render(TemplateOptions, {
    items: [{ ...template, version: '2.0.0' }],
    value: template,
    disabled: true,
    onChange() {},
  });
  assert.match(html, /No template — start with your own question/);
  assert.match(html, /saved version 1.0.0/);
  assert.match(html, /value="market-access@1.0.0"[^>]*selected=""/);
  assert.match(html, /<select[^>]*disabled=""/);
  assert.doesNotMatch(html, /required=/);
  assert.equal(templateKey(template), 'market-access@1.0.0');
  assert.deepEqual(templateReference(template), {
    id: 'market-access',
    version: '1.0.0',
  });
  assert.equal(templateReference(null), null);
});

test('template starter fills empty fields only and preserves question, monitoring, audience and source choices', () => {
  const config = {
    name: 'My dossier',
    sector: '  ',
    goal: '',
    source_pack_ids: ['recorded-source'],
    topics: [],
    delivery: 'keep',
    audience: 'client',
  };
  const next = templateStarter(config, template);
  assert.equal(next.sector, template.sector);
  assert.equal(next.goal, template.goal);
  assert.equal(config.goal, '');
  for (const key of [
    'name',
    'source_pack_ids',
    'topics',
    'delivery',
    'audience',
  ])
    assert.deepEqual(next[key], config[key]);
  const written = { ...config, sector: 'User context', goal: 'User question' };
  assert.deepEqual(templateStarter(written, template), written);
});

test('template history attributes changes and retains old guidance instead of substituting current registry content', () => {
  const entry = {
    id: 'event',
    kind: 'dossier_template',
    author: 'Ada <script>',
    created_at: '2026-09-28T13:00:00Z',
    data: {
      revision: 3,
      template_before: { ...template, version: '0.9.0' },
      template_after: template,
    },
  };
  const html = render(TemplateHistory, { entries: [entry] });
  assert.match(html, /Template history/);
  assert.match(html, /Ada &lt;script&gt;/);
  assert.match(html, /Before:/);
  assert.match(html, /version 0.9.0/);
  assert.match(html, /After:/);
  assert.match(html, /Which market/);
  assert.doesNotMatch(html, /<script>/);
  const unknown = render(TemplateHistory, {
    entries: [
      {
        ...entry,
        data: {
          ...entry.data,
          template_after: {
            id: 'future',
            schema_id: 'future',
            title: 'Retained',
          },
        },
      },
    ],
  });
  assert.match(unknown, /private JSON export/);
  assert.doesNotMatch(unknown, /Which market/);
});

test('dossier template reader preserves role restrictions and unknown-format recovery', () => {
  const props = {
    value: { saved: true, available: true, selection: template },
    dossierId: 'dossier',
    revision: 3,
    entries: [],
    canEdit: false,
    busy: '',
    onChanged: async () => {},
    notify() {},
  };
  const html = render(DossierTemplateSection, props);
  assert.match(html, /Research approach/);
  assert.match(html, /Which product/);
  assert.doesNotMatch(html, /Change template/);
  assert.match(
    render(DossierTemplateSection, { ...props, canEdit: true }),
    /Change template/,
  );
  const unknown = render(DossierTemplateSection, {
    ...props,
    canEdit: true,
    value: { saved: true, available: false, selection: null },
  });
  assert.match(unknown, /unavailable format/);
  assert.doesNotMatch(unknown, /Change template/);
  assert.match(
    render(DossierTemplateSection, {
      ...props,
      canEdit: true,
      value: undefined,
    }),
    /Choose a template/,
  );
});
