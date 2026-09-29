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
    ['dossier-overview-details.tsx'].some((file) =>
      parent?.filename.endsWith('/components/' + file),
    ) &&
    name === './ui/button'
  )
    return { Button: (props) => React.createElement('button', props) };
  return originalLoad.call(this, name, parent, ...args);
};
const { DossierTopicOverview, DossierRecentActivity } = require(
  resolve('components/dossier-overview-details.tsx'),
);
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
const text = (value) =>
  typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.map(text).join('')
      : value
        ? text(value.children)
        : '';
const defaults = () => ({
  profile: { topics: [], status: 'draft' },
  questionMonitoring: true,
  matches: [],
  loading: false,
  error: '',
  canConfigure: false,
  busy: false,
  onRetry() {},
  onSources() {},
  onSetup() {},
  renderMatch: (match) =>
    React.createElement('article', { key: match.id }, match.title),
});
const html = (props) =>
  renderToStaticMarkup(
    React.createElement(DossierTopicOverview, { ...defaults(), ...props }),
  );

test('question-only dossier has no redundant empty card, but failed or loading topic reads remain visible and retryable', async () => {
  assert.equal(html({}), '');
  let retries = 0,
    sources = 0,
    rendered = 0,
    tree;
  const props = {
    ...defaults(),
    matches: [{ id: 'private', title: 'RETAINED PRIVATE MATCH' }],
    renderMatch: () => {
      rendered++;
      return 'RETAINED PRIVATE MATCH';
    },
    onRetry: () => retries++,
    onSources: () => sources++,
  };
  try {
    await act(async () => {
      tree = create(
        React.createElement(DossierTopicOverview, { ...props, loading: true }),
      );
    });
    assert.match(text(tree.toJSON()), /Loading saved topic matches/);
    assert.equal(rendered, 0);
    await act(async () => {
      tree.update(
        React.createElement(DossierTopicOverview, {
          ...props,
          error: 'Access could not be checked.',
        }),
      );
    });
    assert.match(text(tree.toJSON()), /Topic updates could not be loaded/);
    assert.equal(rendered, 0);
    const retry = tree.root
      .findAllByType('button')
      .find(
        (node) =>
          text(node.toJSON ? node.toJSON() : { children: node.children }) ===
          'Retry topic updates',
      );
    await act(async () => {
      retry.props.onClick();
    });
    await act(async () => {
      tree.root
        .findAllByType('button')
        .find((node) => node.children.join('') === 'View sources')
        .props.onClick();
    });
    assert.equal(retries, 1);
    assert.equal(sources, 1);
    await act(async () => {
      tree.update(React.createElement(DossierTopicOverview, defaults()));
    });
    assert.equal(tree.toJSON(), null);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('real topic evidence stays visible without configured topics and retains exact records for source/review actions', () => {
  const matches = Array.from({ length: 6 }, (_, i) => ({
    id: 'match-' + i,
    title: 'Source event ' + i,
  }));
  const passed = [];
  const output = html({
    matches,
    renderMatch: (match) => {
      passed.push(match);
      return React.createElement('article', { key: match.id }, match.title);
    },
  });
  assert.match(output, /Topic monitoring updates/);
  assert.match(output, /Source event 0/);
  assert.match(output, /Source event 4/);
  assert.doesNotMatch(
    output,
    /Source event 5|No saved|Open research|Complete monitoring setup/,
  );
  assert.deepEqual(passed, matches.slice(0, 5));
  assert(passed.every((match, i) => match === matches[i]));
});

test('configured topics retain collapsed goals and history; classic setup respects permission and busy state', async () => {
  const topics = [
    {
      id: 'topic-a',
      current_revision: 2,
      plan: {
        name: '<script>Topic</script>',
        goal: 'Saved goal',
        concepts: ['Original term'],
      },
      revisions: [
        {
          revision: 1,
          created_at: '2026-09-29T10:00:00Z',
          concepts: ['Earlier term'],
        },
      ],
    },
  ];
  const output = html({ profile: { topics, status: 'active' } });
  assert.match(
    output,
    /<details class="dossier-secondary"><summary>Monitoring topics/,
  );
  assert.doesNotMatch(output, /<details[^>]* open|<script>/);
  assert.match(output, /&lt;script&gt;Topic/);
  assert.match(output, /Saved goal/);
  assert.match(output, /Earlier term/);
  assert.match(output, /No saved topic matches yet/);
  assert.match(output, /all sources were checked/);
  assert.doesNotMatch(
    html({ questionMonitoring: false }),
    /<button[^>]*>Complete monitoring setup/,
  );
  assert.match(
    html({ questionMonitoring: false, canConfigure: true, busy: true }),
    /<button[^>]*disabled=""[^>]*>Complete monitoring setup/,
  );
  assert.doesNotMatch(
    html({
      questionMonitoring: false,
      canConfigure: true,
      profile: { topics: [], status: 'active' },
    }),
    /Complete monitoring setup|monitoring has not started/,
  );
  let setup = 0,
    tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(DossierTopicOverview, {
          ...defaults(),
          questionMonitoring: false,
          canConfigure: true,
          onSetup: () => setup++,
        }),
      );
    });
    await act(async () => {
      tree.root
        .findAllByType('button')
        .find((node) => node.children.join('') === 'Complete monitoring setup')
        .props.onClick();
    });
    assert.equal(setup, 1);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('recent activity is closed, bounded, attributed and escaped without presenting AI activity as a human note', () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    id: 'entry-' + i,
    kind: i === 1 ? 'proposal' : 'note',
    title: i === 0 ? '<script>Untrusted title</script>' : '',
    author: 'Author ' + i,
    created_at: '2026-09-29T10:00:00Z',
  }));
  const output = renderToStaticMarkup(
    React.createElement(DossierRecentActivity, { entries }),
  );
  assert.match(
    output,
    /<details class="dossier-secondary dossier-recent-activity"><summary>Recent activity/,
  );
  assert.match(output, /Showing 8 recent loaded entries/);
  assert.match(output, /&lt;script&gt;Untrusted title/);
  assert.match(output, /AI refinement proposed/);
  assert.match(output, /Comment added/);
  assert.match(output, /Author 7/);
  assert.doesNotMatch(output, /Author 8|<script>|<details[^>]* open/);
  assert.equal(
    renderToStaticMarkup(
      React.createElement(DossierRecentActivity, { entries: [] }),
    ),
    '',
  );
});
