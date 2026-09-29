import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

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
    ['exploration.tsx', 'web-research.tsx'].some((file) =>
      parent?.filename.endsWith('/components/' + file),
    ) &&
    name === './ui/button'
  )
    return { Button: (props) => React.createElement('button', props) };
  return originalLoad.call(this, name, parent, ...args);
};
const { Exploration } = require(resolve('components/exploration.tsx'));
const { product } = require(resolve('lib/product.ts'));
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

const text = (tree) => JSON.stringify(tree.toJSON());
const base = `/api/products/${product.id}/dossiers/d/investigations`;
const props = {
  dossierId: 'd',
  initialId: 'r',
  canEdit: true,
  onChanged: async () => {},
  onOpen: () => {},
};
const episode = (changes = {}) => ({
  id: 'r',
  question: 'A rough question',
  status: 'completed',
  revision: 20,
  stop_reason: 'Bounded research finished.',
  branches: [],
  exploration: {
    status: 'ready',
    revision: 18,
    sources: [
      {
        id: 's',
        title: 'Registry source',
        url: 'https://example.org/record',
        captured_at: '2026-09-29T10:00:00Z',
        excerpts: [{ text: 'The source passage is here.', passage: 'p1' }],
      },
    ],
    briefing: {
      understanding: 'You may mean this entity; please correct me.',
      findings: [
        {
          source_id: 's',
          statement: 'An AI interpretation.',
          quote: 'The source passage is here.',
          locator: 'p1',
          basis: 'analogy',
        },
      ],
      uncertainties: ['The intended entity is not yet confirmed.'],
      clarification: 'Which outcome matters most?',
      directions: [
        {
          source_id: 's',
          question: 'Check the entity in the register.',
          why: 'The first record gives a possible identity.',
          quote: 'The source passage is here.',
          locator: 'p1',
        },
        {
          source_id: 's',
          question: 'Check the wider social context.',
          why: 'Consider the context around the record.',
          quote: 'The source passage is here.',
          locator: 'p1',
        },
      ],
    },
  },
  ...changes,
});
const findButton = (tree, label) =>
  tree.root
    .findAllByType('button')
    .find((button) => button.props.children === label);
function serve(value, writes) {
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === 'POST') return writes(url, init);
    if (url === base)
      return Response.json({ items: [{ id: value.id, exploratory: true }] });
    if (url === `${base}/${value.id}`) return Response.json(value);
    if (url.endsWith('/web-research'))
      return Response.json({
        dossier_id: 'd',
        can_manage: false,
        policy: {},
        items: [],
      });
    throw new Error('Unexpected URL');
  };
}
test('briefing separates tentative understanding, analogy and exact source passage without starting work', async () => {
  let tree,
    count = 0;
  serve(episode(), () => {
    count++;
    return Response.json({});
  });
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    assert.match(text(tree), /AI · tentative understanding/);
    assert.match(text(tree), /AI · analogy, not a direct match/);
    assert.match(text(tree), /The source passage is here/);
    assert.match(text(tree), /Which outcome matters most/);
    assert.equal(count, 0);
    assert.equal(
      tree.root.findAllByType('blockquote')[0].props.children,
      'The source passage is here.',
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
test('a choice sends the exact public question and checkpoint, and retries a lost response with the same key', async () => {
  let tree,
    changed = 0;
  const writes = [];
  serve(
    episode(),
    (url, init) =>
      new Promise((resolve) => writes.push({ url, init, resolve })),
  );
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, {
          ...props,
          onChanged: async () => changed++,
        }),
      );
    });
    await act(async () => {
      findButton(tree, 'Check the entity in the register.').props.onClick();
      findButton(tree, 'Check the entity in the register.').props.onClick();
    });
    assert.equal(writes.length, 1);
    const body = JSON.parse(writes[0].init.body);
    assert.equal(body.question, 'Check the entity in the register.');
    assert.equal(body.expected_revision, 18);
    assert.equal(body.direction, 0);
    assert.equal(body.public_query_confirmed, true);
    assert.equal(writes[0].url, `${base}/r/exploration/reply`);
    await act(async () =>
      writes[0].resolve(Response.json({}, { status: 503 })),
    );
    await act(async () =>
      findButton(tree, 'Retry this direction safely').props.onClick(),
    );
    assert.deepEqual(JSON.parse(writes[1].init.body), body);
    await act(async () => writes[1].resolve(Response.json({ id: 'next' })));
    assert.equal(changed, 1);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
test('read-only access cannot select a direction; access errors hide old briefings', async () => {
  let tree;
  serve(episode(), () => {
    throw new Error('No writes allowed');
  });
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.equal(
      findButton(tree, 'Check the entity in the register.'),
      undefined,
    );
    globalThis.fetch = async () => Response.json({}, { status: 403 });
    await act(async () => {
      tree.update(
        React.createElement(Exploration, {
          ...props,
          dossierId: 'different',
          initialId: 'other',
        }),
      );
    });
    assert.doesNotMatch(text(tree), /An AI interpretation/);
    assert.match(text(tree), /hidden until access/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
test('early captured passages and a real pause are available before a briefing', async () => {
  let tree;
  const writes = [];
  const value = episode({ status: 'running' });
  value.exploration.briefing = null;
  value.exploration.status = 'exploring';
  serve(value, async (url, init) => {
    writes.push({ url, body: JSON.parse(init.body) });
    return Response.json({});
  });
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    assert.match(text(tree), /Source passage · not an AI conclusion/);
    assert.doesNotMatch(text(tree), /Which outcome matters most/);
    await act(async () => findButton(tree, 'Pause research').props.onClick());
    assert.deepEqual(writes, [
      {
        url: `${base}/r/control`,
        body: { expected_revision: 20, action: 'pause' },
      },
    ]);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
