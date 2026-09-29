import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
const extensions = new Map(
  ['.ts', '.tsx'].map((ext) => [ext, Module._extensions[ext]]),
);
const globals = new Map(
  ['fetch', 'window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
    key,
    globalThis[key],
  ]),
);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.document = { cookie: 'helvetic_lens_csrf=fixture' };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(
    this,
    name.startsWith('@/') ? resolve(name.slice(2)) : name,
    ...args,
  );
};
for (const ext of extensions.keys())
  Module._extensions[ext] = (module, filename) => {
    module._compile(
      ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
        fileName: filename,
      }).outputText,
      filename,
    );
  };
// Keep the real stateful product components; replace DOM-dependent button plumbing.
Module._load = function (name, parent, ...args) {
  if (
    ['dossier-reading.tsx'].some((file) =>
      parent?.filename.endsWith('/components/' + file),
    ) &&
    name === './ui/button'
  )
    return { Button: (props) => React.createElement('button', props) };
  return originalLoad.call(this, name, parent, ...args);
};
const { DossierReading, ReadingSummary } = require(
  resolve('components/dossier-reading.tsx'),
);
const { researchProgress } = require(resolve('lib/dossier-reading.ts'));
const listeners = new Set();
globalThis.window.addEventListener = (name, listener) => {
  if (name === 'helvetic-session-changed') listeners.add(listener);
};
globalThis.window.removeEventListener = (name, listener) => {
  if (name === 'helvetic-session-changed') listeners.delete(listener);
};
after(() => {
  Module._resolveFilename = originalResolve;
  Module._load = originalLoad;
  for (const [ext, value] of extensions)
    if (value) Module._extensions[ext] = value;
    else delete Module._extensions[ext];
  for (const [key, value] of globals)
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
});
const visibleText = (value) =>
  typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.map(visibleText).join('')
      : value
        ? visibleText(value.children)
        : '';
const text = (tree) => visibleText(tree.toJSON());
const button = (tree, label) =>
  tree.root
    .findAllByType('button')
    .find((node) => node.children.join('') === label);
function fixture(id = 'a', label = 'PRIVATE A') {
  return {
    runs: {
      items: [
        {
          id: 'latest',
          question: 'Newer question',
          status: 'failed',
          stop_reason: 'A source could not be read.',
          updated_at: '2026-09-29T11:00:00Z',
        },
      ],
      total: 2,
    },
    updates: {
      items: [
        {
          investigation_id: 'saved',
          question: 'Earlier public question',
          completed_at: '2026-09-29T10:00:00Z',
          source_count: 2,
          finding_count: 4,
          comparison_counts: { CONTRADICTS: 1, UPDATES: 2 },
          findings: [
            {
              id: 'claim-a',
              statement: label,
              status: 'CONTESTED',
              source_id: 'cited-other',
            },
            {
              id: 'uncited',
              statement: 'UNCITED SHOULD NOT BE RETOLD',
              status: 'SUPPORTED',
              source_id: null,
            },
          ],
          sources: [
            {
              id: 'excerpt-source',
              title: 'Saved public source',
              quote: '<script>Original wording</script>',
              locator: 'p4',
              truncated: true,
              url: 'javascript:alert(1)',
            },
          ],
          comparisons: [],
        },
      ],
      total: 2,
    },
    coverage: {
      schema_id: 'dossier-coverage/v1',
      dossier_id: id,
      documents: [
        { id: 'page', name: 'Registry', last_result: 'failed', active: true },
      ],
      packs: [],
      topics: [],
      limitations: [],
      web_research: { enabled: true },
    },
  };
}
function deferredReads() {
  const reads = [];
  globalThis.fetch = (url, init) => {
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    return new Promise((resolve) => reads.push({ url, init, resolve }));
  };
  return reads;
}
function resolvePage(reads, value, failure = '') {
  for (const read of reads) {
    const key = read.url.endsWith('/follow/updates')
      ? 'updates'
      : read.url.endsWith('/coverage')
        ? 'coverage'
        : 'runs';
    read.resolve(
      Response.json(key === failure ? {} : value[key], {
        status: key === failure ? 403 : 200,
      }),
    );
  }
}
const callbacks = { onOpen() {}, onCoverage() {} };

test('the overview separates previous evidence from a newer failure and links exact claims and sources', async () => {
  let tree;
  const opened = [];
  let coverage = 0;
  try {
    await act(async () => {
      tree = create(
        React.createElement(ReadingSummary, {
          ...fixture(),
          onOpen: (...args) => opened.push(args),
          onCoverage: () => coverage++,
        }),
      );
    });
    assert.match(text(tree), /Latest research needs attention/);
    assert.match(text(tree), /earlier completed investigation/);
    assert.match(text(tree), /PRIVATE A/);
    assert.match(text(tree), /possible contradictions/);
    assert.match(text(tree), /proposed updates/);
    assert.match(text(tree), /Recorded AI assessment:/);
    assert.match(text(tree), /Contested/);
    assert.doesNotMatch(text(tree), /UNCITED SHOULD NOT BE RETOLD/);
    assert.equal(
      tree.root.findByType('blockquote').children.join(''),
      '<script>Original wording</script>',
    );
    assert.equal(
      tree.root.findAllByType('input').length +
        tree.root.findAllByType('select').length,
      0,
    );
    await act(async () => {
      button(tree, 'Read finding').props.onClick();
      button(tree, 'View cited source').props.onClick();
      button(tree, 'Saved public source · p4').props.onClick();
      button(tree, 'See source checks and limitations').props.onClick();
    });
    assert.deepEqual(opened, [
      ['saved', 'claim-claim-a'],
      ['saved', 'source-cited-other'],
      ['saved', 'source-excerpt-source'],
    ]);
    assert.equal(coverage, 1);
    assert.match(text(tree), /Last check failed/);
    assert.match(text(tree), /Showing 2 of 4/);
    assert.match(text(tree), /Excerpt shortened/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('source excerpts are escaped and never become provider-supplied external links', () => {
  const html = renderToStaticMarkup(
    React.createElement(ReadingSummary, { ...fixture(), ...callbacks }),
  );
  assert.match(html, /&lt;script&gt;Original wording&lt;\/script&gt;/);
  assert.doesNotMatch(
    html,
    /<script>|href="javascript:|Verified truth|Human accepted/,
  );
});

test('finished or empty research and empty source lists never imply complete coverage', () => {
  const value = fixture();
  value.runs.items[0].status = 'completed';
  value.updates = { items: [], total: 0 };
  value.coverage.documents = [];
  let html = renderToStaticMarkup(
    React.createElement(ReadingSummary, { ...value, ...callbacks }),
  );
  assert.match(html, /Latest investigation finished/);
  assert.match(
    html,
    /No completed research with new, accessible source evidence/,
  );
  assert.match(html, /does not establish complete coverage/);
  assert.doesNotMatch(
    html,
    /No changes found|All sources checked|Source checks need attention/,
  );
  value.runs.items = [];
  html = renderToStaticMarkup(
    React.createElement(ReadingSummary, { ...value, ...callbacks }),
  );
  assert.match(html, /No investigation saved yet/);
});

test('each research lifecycle state has a plain and distinct reading state', () => {
  assert.equal(researchProgress({ status: 'queued' }), 'Research is queued');
  assert.equal(
    researchProgress({ status: 'running' }),
    'Research is in progress',
  );
  assert.equal(researchProgress({ status: 'paused' }), 'Research is paused');
  assert.equal(
    researchProgress({ status: 'cancelled' }),
    'Latest research was stopped',
  );
  assert.equal(
    researchProgress({ status: 'completed' }),
    'Latest investigation finished',
  );
});

test('current-session reads hide private results on access failure, recover by GET only and never acknowledge updates', async () => {
  const reads = deferredReads();
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(DossierReading, { dossierId: 'a', ...callbacks }),
      );
    });
    assert.equal(reads.length, 3);
    assert.match(text(tree), /Loading saved research/);
    await act(async () => resolvePage(reads.slice(0, 3), fixture()));
    assert.match(text(tree), /PRIVATE A/);
    await act(async () => {
      for (const listener of listeners) listener();
    });
    assert.doesNotMatch(text(tree), /PRIVATE A|Original wording/);
    await act(async () =>
      resolvePage(reads.slice(3, 6), fixture(), 'coverage'),
    );
    assert.match(text(tree), /Saved results are hidden/);
    assert.doesNotMatch(text(tree), /PRIVATE A|Original wording/);
    await act(async () => button(tree, 'Refresh summary').props.onClick());
    await act(async () =>
      resolvePage(reads.slice(6, 9), fixture('a', 'RECOVERED CURRENT')),
    );
    assert.match(text(tree), /RECOVERED CURRENT/);
    assert.equal(reads.length, 9);
    assert.equal(
      reads.some((read) => read.url.endsWith('/read')),
      false,
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('late old-dossier responses cannot restore old evidence after navigation', async () => {
  const reads = deferredReads();
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(DossierReading, { dossierId: 'a', ...callbacks }),
      );
    });
    await act(async () => {
      tree.update(
        React.createElement(DossierReading, { dossierId: 'b', ...callbacks }),
      );
    });
    assert.equal(reads.length, 6);
    assert.ok(reads.slice(0, 3).every((read) => read.init.signal.aborted));
    await act(async () =>
      resolvePage(reads.slice(3, 6), fixture('b', 'PRIVATE B')),
    );
    await act(async () =>
      resolvePage(reads.slice(0, 3), fixture('a', 'LATE PRIVATE A')),
    );
    assert.match(text(tree), /PRIVATE B/);
    assert.doesNotMatch(text(tree), /LATE PRIVATE A/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('a coverage response for another dossier cannot be combined with saved findings', async () => {
  const reads = deferredReads();
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(DossierReading, { dossierId: 'a', ...callbacks }),
      );
    });
    await act(async () =>
      resolvePage(reads, fixture('wrong', 'SHOULD REMAIN HIDDEN')),
    );
    assert.doesNotMatch(text(tree), /SHOULD REMAIN HIDDEN/);
    assert.match(text(tree), /Loading saved research/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
