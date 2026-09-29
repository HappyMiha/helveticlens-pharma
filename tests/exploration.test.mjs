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

const orientation = () => ({
  status: 'ready',
  revision: 12,
  saved_at: '2026-09-29T10:01:00Z',
  briefing: {
    interpretations: [
      {
        source_id: 's',
        quote: 'The source passage is here.',
        locator: 'p1',
        meaning: 'A possible interpretation of the rough question.',
        why: 'The passage names the possible subject.',
        signal: 'possible',
      },
      {
        source_id: 's',
        quote: 'The source passage is here.',
        locator: 'p1',
        meaning: 'Another interpretation is now in doubt.',
        why: 'The passage does not describe that intended scope.',
        signal: 'questioned',
      },
    ],
    uncertainties: ['The intended purpose is still unconfirmed.'],
  },
});

test('early understanding is tentative, cited and does not request a direction or enable monitoring while work continues', async () => {
  let tree;
  const value = episode({
    status: 'running',
    branches: [
      {
        id: 'early',
        phase: 'orient',
        query: 'Internal orientation identifier',
      },
    ],
  });
  value.exploration.briefing = null;
  value.exploration.status = 'exploring';
  value.exploration.orientation = orientation();
  serve(value, () => {
    throw new Error('Reading must not create work');
  });
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    assert.match(text(tree), /A rough question/);
    assert.match(text(tree), /A first reading of your question/);
    assert.match(text(tree), /Possible meaning · not confirmed/);
    assert.match(text(tree), /Evidence questions this interpretation/);
    assert.match(text(tree), /The source passage is here/);
    assert.doesNotMatch(
      text(tree),
      /Internal orientation identifier|Keep watching this topic|Where would you like to go next/,
    );
    assert.ok(findButton(tree, 'Pause to change direction'));
    assert.equal(tree.root.findAllByType('form').length, 0);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('pausing before any briefing uses the refreshed checkpoint for a corrected public question', async () => {
  let tree;
  const writes = [];
  const value = episode({ status: 'running' });
  value.exploration.briefing = null;
  value.exploration.status = 'exploring';
  value.exploration.revision = 0;
  serve(value, async (url, init) => {
    writes.push({ url, body: JSON.parse(init.body) });
    if (url.endsWith('/control')) {
      value.status = 'paused';
      value.exploration.revision = 21;
    }
    return Response.json({ id: 'next' });
  });
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    await act(async () => findButton(tree, 'Pause research').props.onClick());
    assert.match(text(tree), /Change direction in your own words/);
    await act(async () =>
      tree.root.findByType('textarea').props.onChange({
        target: { value: 'A corrected question for public research.' },
      }),
    );
    await act(async () =>
      tree.root.findByType('form').props.onSubmit({ preventDefault() {} }),
    );
    assert.equal(writes.length, 2);
    assert.equal(writes[1].url, `${base}/r/exploration/reply`);
    assert.equal(writes[1].body.expected_revision, 21);
    assert.equal(
      writes[1].body.question,
      'A corrected question for public research.',
    );
    assert.equal(writes[1].body.public_query_confirmed, true);
    assert.equal(value.question, 'A rough question');
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('completed reading retains the earlier working interpretation separately and access failure hides both', async () => {
  let tree;
  const value = episode();
  value.exploration.orientation = orientation();
  serve(value, () => {
    throw new Error('Read only');
  });
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.match(text(tree), /AI · tentative understanding/);
    assert.match(text(tree), /Earlier working interpretation/);
    assert.match(text(tree), /may have been revised by later evidence/);
    const history = tree.root
      .findAllByType('details')
      .find((item) =>
        item
          .findAllByType('summary')
          .some((s) => s.props.children === 'Earlier working interpretation'),
      );
    assert.ok(history);
    assert.equal(history.props.open, undefined);
    globalThis.fetch = async () => Response.json({}, { status: 403 });
    await act(async () =>
      tree.update(
        React.createElement(Exploration, {
          ...props,
          dossierId: 'revoked',
          initialId: 'denied',
        }),
      ),
    );
    assert.doesNotMatch(
      text(tree),
      /possible interpretation of the rough question|An AI interpretation/,
    );
    assert.match(text(tree), /hidden until access/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('withheld early interpretation has an honest explanation and no stale generated text', async () => {
  let tree;
  const value = episode({ status: 'running' });
  value.exploration.briefing = null;
  value.exploration.status = 'exploring';
  value.exploration.orientation = {
    ...orientation(),
    status: 'evidence_changed',
    briefing: null,
  };
  serve(value, () => {
    throw new Error('Read only');
  });
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.match(text(tree), /hidden because its supporting sources changed/);
    assert.match(text(tree), /Source passage · not an AI conclusion/);
    assert.doesNotMatch(
      text(tree),
      /possible interpretation of the rough question|Keep watching this topic/,
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

const change = () => ({
  question_id: 'next-question',
  source_id: 's',
  quote: 'The source passage is here.',
  locator: 'p1',
  earlier_meaning: 'One reported grant might answer the question.',
  meaning: 'The research may need to distinguish award and payment.',
  why: 'The new record reports another amount for the same year.',
  signal: 'questioned',
  question: 'Do payment periods explain the difference?',
  status: 'investigating',
  searches_completed: 0,
  reads_completed: 0,
});
for (const stage of ['queued', 'complete', 'budget', 'hidden'])
  test(`changed interpretation explains the actual follow-up: ${stage}`, async () => {
    let tree;
    const value = episode({
      status: stage === 'queued' ? 'running' : 'completed',
    });
    value.exploration.orientation = orientation();
    value.exploration.changes = [change()];
    if (stage === 'queued') {
      value.exploration.briefing = null;
      value.exploration.status = 'exploring';
    }
    if (stage === 'complete')
      Object.assign(value.exploration.changes[0], {
        status: 'evidence_found',
        searches_completed: 1,
        reads_completed: 1,
      });
    if (stage === 'budget')
      value.exploration.changes[0].waiting_reason = 'branch_budget';
    if (stage === 'hidden') {
      value.exploration.changes_unavailable = true;
      value.exploration.changes = [];
    }
    serve(value, () => {
      throw new Error('Viewing a change cannot start another episode');
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, { ...props, canEdit: false }),
        );
      });
      if (stage === 'hidden') {
        assert.match(text(tree), /revised research direction is hidden/);
        assert.doesNotMatch(text(tree), /Do payment periods explain/);
      } else {
        assert.match(text(tree), /A rough question/);
        assert.match(text(tree), /earlier interpretation questioned/);
        assert.match(text(tree), /One reported grant might answer/);
        assert.match(text(tree), /Do payment periods explain/);
        assert.match(text(tree), /The source passage is here/);
        assert.match(
          text(tree),
          stage === 'queued'
            ? /search has not completed yet/
            : stage === 'budget'
              ? /Not completed within/
              : /Supporting material saved/,
        );
        if (stage === 'queued' || stage === 'budget')
          assert.doesNotMatch(text(tree), /completed reads\./);
      }
      assert.equal(tree.root.findAllByType('form').length, 0);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });
