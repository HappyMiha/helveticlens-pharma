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
    assert.ok(findButton(tree, 'Pause research'));
    assert.equal(tree.root.findAllByType('form').length, 1);
    assert.match(text(tree), /Change direction in your own words/);
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

const savedCheck = () => ({
  investigation_id: 'r',
  question_id: 'saved-gap',
  question: 'Do payment periods explain the reported difference?',
  original_question: 'A rough question',
  purpose: 'Read a reconciliation of awards and payments.',
  why: 'Two public records report different amounts for the same period.',
  quote: 'An earlier source reported a different amount.',
  locator: 'p2',
  source: {
    id: 'earlier-source',
    title: 'Earlier record',
    url: 'https://example.org/earlier',
    captured_at: '2026-09-29T10:00:00Z',
  },
});

const selectedDirection = () => ({
  contract: 'selected-direction/v1',
  status: 'ready',
  investigation_id: 'earlier-run',
  orientation_revision: 17,
  direction_index: 0,
  question: 'Investigate the recipient account.',
  original_question: 'Alpin money — what is happening?',
  why: 'The earlier record suggests comparing recipients and payments.',
  quote: 'The retained earlier account records a payment.',
  locator: 'p3',
  source: {
    id: 'prior-source',
    title: 'Earlier recipient account',
    url: 'https://example.org/prior-account',
    captured_at: '2026-09-29T10:00:00Z',
  },
});

for (const status of ['queued', 'running', 'paused', 'completed'])
  test(`chosen direction keeps original words and an earlier passage without new controls: ${status}`, async () => {
    const value = episode({ status, question: selectedDirection().question });
    value.exploration.selected_direction = selectedDirection();
    if (status !== 'completed') {
      value.exploration.status = 'exploring';
      value.exploration.briefing = null;
    }
    serve(value, () => {
      throw new Error('Reading selected context must not write');
    });
    let tree;
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, { ...props, canEdit: false }),
        );
      });
      assert.match(
        text(tree),
        /Your selected direction · earlier research context/,
      );
      assert.match(text(tree), /AI · why this direction/);
      assert.match(text(tree), /earlier record suggests comparing recipients/);
      assert.match(text(tree), /Alpin money — what is happening/);
      const block = tree.root.findAllByProps({
        'aria-label': 'Following your chosen direction',
      });
      assert.equal(block.length, 1);
      const details = block[0].findByType('details');
      assert.ok(!details.props.open);
      assert.equal(
        details.findByType('blockquote').props.children,
        selectedDirection().quote,
      );
      assert.equal(
        details.findByType('a').props.href,
        selectedDirection().source.url,
      );
      assert.equal(block[0].findAllByType('button').length, 0);
      assert.equal(block[0].findAllByType('textarea').length, 0);
      assert.doesNotMatch(
        text(tree),
        /selected-direction\/v1|orientation_revision|prior-source|earlier-run/,
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const mode of ['changed', 'episode_changed', 'legacy', 'unknown'])
  test(`chosen direction does not revive unavailable or legacy context: ${mode}`, async () => {
    const value = episode();
    if (mode !== 'legacy')
      value.exploration.selected_direction = selectedDirection();
    if (mode === 'changed')
      value.exploration.selected_direction = { status: 'evidence_changed' };
    if (mode === 'episode_changed') {
      value.exploration.status = 'evidence_changed';
      value.exploration.briefing = null;
    }
    if (mode === 'unknown')
      value.exploration.selected_direction.contract = 'unknown';
    serve(value, () => {
      throw new Error('Reading must not write');
    });
    let tree;
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, { ...props, canEdit: false }),
        );
      });
      assert.doesNotMatch(
        text(tree),
        /AI · why this direction|earlier record suggests comparing recipients|retained earlier account|Alpin money/,
      );
      if (mode === 'changed' || mode === 'episode_changed')
        assert.match(text(tree), /behind your chosen direction changed/);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

test('chosen direction polling removes changed context and rejects a late response after denial', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const value = episode({ status: 'running' });
  value.exploration.status = 'exploring';
  value.exploration.briefing = null;
  value.exploration.selected_direction = selectedDirection();
  serve(value, () => {
    throw new Error('Context polling must not write');
  });
  const initialFetch = globalThis.fetch;
  let defer = false;
  const pending = [];
  globalThis.fetch = (url, init) =>
    defer && url === `${base}/r`
      ? new Promise((resolve) => pending.push(resolve))
      : initialFetch(url, init);
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.match(text(tree), /AI · why this direction/);
    defer = true;
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => t.mock.timers.tick(10000));
    const changed = structuredClone(value);
    changed.revision++;
    changed.exploration.selected_direction = { status: 'evidence_changed' };
    await act(async () => pending[1](Response.json(changed)));
    await act(async () => pending[0](Response.json(value)));
    assert.match(text(tree), /behind your chosen direction changed/);
    assert.doesNotMatch(
      text(tree),
      /AI · why this direction|retained earlier account/,
    );
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => pending[3](Response.json({}, { status: 403 })));
    await act(async () => pending[2](Response.json(value)));
    assert.doesNotMatch(
      text(tree),
      /AI · why this direction|retained earlier account|Alpin money/,
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
test('one saved check sends its typed identity and exact question, keeping alternatives secondary and retrying once', async () => {
  let tree;
  const writes = [];
  const value = episode();
  value.exploration.next_check = savedCheck();
  serve(
    value,
    (url, init) =>
      new Promise((resolve) =>
        writes.push({ url, body: JSON.parse(init.body), resolve }),
      ),
  );
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    assert.match(text(tree), /A useful next check/);
    assert.match(text(tree), /earlier source reported a different amount/);
    assert.equal(
      tree.root
        .findAllByType('button')
        .filter((b) => b.props.children === 'Continue this check').length,
      1,
    );
    const alternatives = tree.root
      .findAllByType('details')
      .find((d) =>
        d
          .findAllByType('summary')
          .some((s) => s.props.children === 'Other directions'),
      );
    assert.ok(alternatives && !alternatives.props.open);
    assert.equal(findButton(tree, 'Continue the broad exploration'), undefined);
    await act(async () => {
      findButton(tree, 'Continue this check').props.onClick();
      findButton(tree, 'Continue this check').props.onClick();
    });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].body.follow_up_id, 'saved-gap');
    assert.equal(writes[0].body.question, savedCheck().question);
    assert.equal(writes[0].body.direction, undefined);
    assert.equal(writes[0].body.expected_revision, 18);
    assert.equal(writes[0].body.public_query_confirmed, true);
    await act(async () =>
      writes[0].resolve(Response.json({}, { status: 503 })),
    );
    await act(async () =>
      findButton(tree, 'Retry this direction safely').props.onClick(),
    );
    assert.deepEqual(writes[1].body, writes[0].body);
    await act(async () => writes[1].resolve(Response.json({ id: 'next' })));
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
test('changed saved-check evidence refreshes the checkpoint and removes the stale action', async () => {
  let tree;
  const value = episode();
  value.exploration.next_check = savedCheck();
  serve(value, async () => {
    value.exploration.next_check = null;
    return Response.json(
      { detail: 'This saved check changed.' },
      { status: 409 },
    );
  });
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    await act(async () =>
      findButton(tree, 'Continue this check').props.onClick(),
    );
    assert.equal(findButton(tree, 'Continue this check'), undefined);
    assert.equal(findButton(tree, 'Retry this direction safely'), undefined);
    assert.doesNotMatch(
      text(tree),
      /earlier source reported a different amount/,
    );
    assert.match(text(tree), /saved check changed/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
for (const mode of ['ready', 'changed', 'readonly', 'running'])
  test(`saved check origin and action boundaries: ${mode}`, async () => {
    let tree;
    const value = episode({
      status: mode === 'running' ? 'running' : 'completed',
    });
    value.exploration.next_check = savedCheck();
    if (mode === 'ready' || mode === 'changed')
      value.exploration.continuation =
        mode === 'ready'
          ? { status: 'ready', ...savedCheck() }
          : { status: 'evidence_changed' };
    if (mode === 'ready' || mode === 'changed')
      value.exploration.next_check = null;
    serve(value, () => {
      throw new Error('Reading cannot start research');
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, {
            ...props,
            canEdit: mode !== 'readonly',
          }),
        );
      });
      assert.equal(findButton(tree, 'Continue this check'), undefined);
      if (mode === 'ready') {
        assert.match(
          text(tree),
          /Your selected check · earlier research context/,
        );
        assert.match(text(tree), /earlier source reported a different amount/);
      }
      if (mode === 'changed') {
        assert.match(text(tree), /earlier evidence behind this check changed/);
        assert.doesNotMatch(
          text(tree),
          /earlier source reported a different amount/,
        );
      }
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const mode of [
  'mixed',
  'repeated',
  'empty',
  'changed',
  'running',
  'partial',
])
  test(`continued episode explains observed capture progress without starting work: ${mode}`, async () => {
    let tree;
    const value = episode({
      status: mode === 'running' ? 'running' : 'completed',
    });
    value.exploration.continuation = { status: 'ready', ...savedCheck() };
    const classes =
      mode === 'empty'
        ? []
        : mode === 'mixed'
          ? ['unmatched', 'changed_capture', 'repeated']
          : ['repeated'];
    const items = classes.map((classification, index) => ({
      classification,
      current: {
        id: `capture-${index}`,
        investigation_id: 'r',
        title: `Current comparison source ${index}`,
        url: `https://example.org/current-${index}`,
        captured_at: '2026-09-29T12:00:00Z',
      },
      previous:
        classification === 'unmatched'
          ? null
          : {
              id: `prior-${index}`,
              investigation_id: 'earlier',
              title: `Prior comparison source ${index}`,
              url: `https://example.org/prior-${index}`,
              captured_at: '2026-09-28T12:00:00Z',
            },
      comparison: {
        basis: 'Saved content relationship, not independent confirmation.',
        temporal_basis: 'Capture dates do not establish event dates.',
      },
    }));
    value.exploration.capture_progress =
      mode === 'changed'
        ? { status: 'evidence_changed' }
        : {
            status: 'ready',
            items,
            counts: Object.fromEntries(
              ['unmatched', 'changed_capture', 'repeated', 'unestablished'].map(
                (key) => [key, classes.filter((c) => c === key).length],
              ),
            ),
            scope: {
              current_captures: items.length,
              previous_captures: 3,
              previous_episodes: 1,
              truncated: mode === 'partial',
            },
          };
    serve(value, () => {
      throw new Error('A comparison must never start work');
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, { ...props, canEdit: false }),
        );
      });
      const content = text(tree);
      assert.equal(findButton(tree, 'Continue this check'), undefined);
      if (mode === 'changed') {
        assert.match(content, /comparison's source material changed/);
        assert.doesNotMatch(
          content,
          /Current comparison source|Compare the saved sources/,
        );
      } else {
        assert.match(content, /What this check added/);
        const detail = tree.root
          .findAllByType('details')
          .find((node) =>
            node
              .findAllByType('summary')
              .some((s) => s.props.children === 'Compare the saved sources'),
          );
        assert.ok(detail && !detail.props.open);
        if (mode === 'mixed') {
          assert.match(
            content,
            /1 new to this comparison · 1 changed · 1 repeated/,
          );
          assert.match(content, /Saved content changed/);
        }
        if (mode === 'repeated' || mode === 'running')
          assert.match(content, /Only previously captured content was read/);
        if (mode === 'empty')
          assert.match(
            content,
            /No eligible source material has been captured/,
          );
        if (mode === 'partial')
          assert.match(content, /covers part of the saved history/);
        assert.match(content, /do not establish independent confirmation/);
      }
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const [status, label] of [
  ['possible_answer', 'A possible answer from the sources'],
  ['partial', 'Some evidence; the question remains open'],
  ['conflicting', 'The read evidence conflicts'],
  ['not_found', 'No answer found in the material read'],
]) {
  test(`selected question assessment: ${status}, cited once with folded context`, async () => {
    const value = episode();
    value.question = 'What payment is documented for the selected period?';
    value.exploration.briefing.assessment = {
      contract: 'selected-question-assessment/v1',
      question_id: 'selected-q',
      question: value.question,
      investigation_id: 'r',
      selected_from_investigation_id: 'older',
      status,
      points: [
        {
          statement: 'This point follows the selected question.',
          evidence: [
            {
              source_id: 's',
              quote: 'The source passage is here.',
              locator: 'p1',
              role:
                status === 'conflicting'
                  ? 'counterevidence'
                  : status === 'not_found'
                    ? 'context'
                    : 'support',
            },
          ],
        },
      ],
      limitations: ['Other periods remain unchecked.'],
    };
    let writes = 0;
    serve(value, () => {
      writes++;
      throw new Error('Reading must not write');
    });
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    const sections = tree.root.findAll(
      (node) => node.props['aria-label'] === 'Assessment of your question',
    );
    assert.equal(sections.length, 1);
    assert.equal(
      tree.root.findAllByProps({ className: 'exploration-question' }).length,
      1,
    );
    assert.ok(text(tree).includes(label));
    assert.ok(text(tree).includes('Other periods remain unchecked.'));
    const details = tree.root.findAllByType('details');
    const evidence = details.find((node) =>
      node
        .findAllByType('summary')
        .some((s) => s.props.children === 'Read the evidence for this point'),
    );
    assert.ok(evidence && !evidence.props.open);
    assert.equal(
      evidence.findByType('blockquote').props.children,
      'The source passage is here.',
    );
    assert.equal(
      evidence.findByType('a').props.href,
      'https://example.org/record',
    );
    const background = details.find((node) =>
      node
        .findAllByType('summary')
        .some(
          (s) =>
            s.props.children === 'Research context & earlier understanding',
        ),
    );
    assert.ok(background && !background.props.open);
    assert.ok(
      JSON.stringify(
        background.findAllByType('p').map((p) => p.props.children),
      ).includes('You may mean this entity'),
    );
    assert.equal(writes, 0);
    await act(async () => tree.unmount());
    const { ExplorationBrief } = require(resolve('components/exploration.tsx'));
    await act(async () => {
      tree = create(
        React.createElement(ExplorationBrief, { state: value.exploration }),
      );
    });
    assert.ok(text(tree).includes(label));
    assert.equal(tree.root.findAllByType('button').length, 0);
    await act(async () => tree.unmount());
  });
}

test('invalidated assessment is absent while retained public passages remain readable', async () => {
  const value = episode();
  value.exploration.status = 'evidence_changed';
  value.exploration.briefing = null;
  value.exploration.capture_progress = { status: 'evidence_changed' };
  serve(value, () => {
    throw new Error('No automatic research');
  });
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(Exploration, { ...props, canEdit: false }),
    );
  });
  assert.equal(
    tree.root.findAll(
      (n) => n.props['aria-label'] === 'Assessment of your question',
    ).length,
    0,
  );
  assert.ok(text(tree).includes('Supporting evidence changed'));
  assert.ok(text(tree).includes('The source passage is here.'));
  await act(async () => tree.unmount());
});

for (const kind of ['brief', 'no_evidence', 'assessment']) {
  test(`observed scope stays visible with ${kind}; details folded and history read-only`, async () => {
    const value = episode();
    value.exploration.research_scope = {
      contract: 'observed-research-scope/v1',
      status: 'ready',
      activity: 'paused',
      searches: { completed: 2, unavailable: 1, interrupted: 0, running: 0 },
      indexes: { completed: 2, unavailable: 1, unknown_searches: 1 },
      reads: { completed: 2, unavailable: 1, interrupted: 1, running: 0 },
      material: {
        sources: 2,
        passages: 5,
        truncated_sources: 1,
        unknown_reader_scope: 1,
      },
      candidates: {
        retrieved: 10,
        not_evaluated: 3,
        evaluation_unavailable: 1,
        selected_not_read: 2,
      },
      questions: { open: 2, not_started: 1 },
      budget_stops: ['source_fetches'],
    };
    if (kind === 'no_evidence') {
      value.exploration.status = 'no_evidence';
      value.exploration.briefing = null;
      value.exploration.research_scope.material = {
        sources: 0,
        passages: 0,
        truncated_sources: 0,
        unknown_reader_scope: 0,
      };
    }
    if (kind === 'assessment')
      value.exploration.briefing.assessment = {
        status: 'partial',
        question: 'A selected question',
        points: [],
        limitations: ['Other periods remain unchecked.'],
      };
    let writes = 0;
    serve(value, () => {
      writes++;
      throw new Error('Reading must not write');
    });
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.equal(
      tree.root.findAllByProps({ 'aria-label': 'Observed research scope' })
        .length,
      1,
    );
    assert.ok(
      text(tree).includes(
        kind === 'no_evidence'
          ? 'No public source passages captured'
          : '5 saved passages',
      ),
    );
    assert.ok(text(tree).includes('3 search or reading attempts'));
    assert.ok(text(tree).includes('1 search index request unavailable'));
    assert.ok(text(tree).includes('2 research questions still open'));
    const details = tree.root
      .findAllByType('details')
      .find((n) =>
        n
          .findAllByType('summary')
          .some(
            (s) => s.props.children === 'What was checked and what remains',
          ),
      );
    assert.ok(details && !details.props.open);
    assert.ok(text(tree).includes('source reading budget'));
    assert.ok(text(tree).includes('wider coverage remains unverified'));
    assert.equal(writes, 0);
    await act(async () => tree.unmount());
    const { ExplorationBrief } = require(resolve('components/exploration.tsx'));
    await act(async () => {
      tree = create(
        React.createElement(ExplorationBrief, { state: value.exploration }),
      );
    });
    assert.equal(
      tree.root.findAllByProps({ 'aria-label': 'Observed research scope' })
        .length,
      1,
    );
    assert.equal(tree.root.findAllByType('button').length, 0);
    await act(async () => tree.unmount());
  });
}

for (const status of ['unknown', 'evidence_changed']) {
  test(`scope ${status} never invents or retains operation counts`, async () => {
    const value = episode();
    value.exploration.research_scope = {
      contract: 'observed-research-scope/v1',
      status,
    };
    if (status === 'evidence_changed') {
      value.exploration.status = status;
      value.exploration.briefing = null;
    }
    serve(value, () => {
      throw new Error('No automatic research');
    });
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.ok(
      text(tree).includes(
        status === 'unknown'
          ? 'coverage is unknown'
          : 'research scope is hidden',
      ),
    );
    assert.ok(!text(tree).includes('What was checked and what remains'));
    assert.ok(!text(tree).includes('0 completed'));
    await act(async () => tree.unmount());
  });
}

const livePurpose = () => ({
  contract: 'research-purpose/v1',
  kind: 'source_follow_up',
  text: 'Check whether the recipient explains the earlier discrepancy.',
  trigger: {
    quote: 'The earlier record reports a different amount.',
    locator: 'p2',
    source: {
      id: 'trigger',
      title: 'Earlier evidence trigger',
      url: 'https://example.org/trigger',
    },
  },
});
const liveActivity = () => ({
  contract: 'research-activity/v1',
  status: 'working',
  phase: 'search',
  question: 'Which recipient record explains the difference?',
  observed_at: '2026-09-29T22:00:00Z',
  valid_for_ms: 50,
  purpose: livePurpose(),
  latest_source: {
    id: 's',
    title: 'Previously captured registry',
    url: 'https://example.org/captured',
    captured_at: '2026-09-29T21:59:00Z',
  },
});

test('active research shows its actual question and an earlier captured source, then expires without fetching', async (t) => {
  let clock = 100;
  t.mock.method(performance, 'now', () => clock);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const value = episode({ status: 'running' });
  value.exploration.status = 'exploring';
  value.exploration.briefing = null;
  value.exploration.current_activity = liveActivity();
  serve(value, () => {
    throw new Error('Activity must not write');
  });
  const fetcher = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (...args) => {
    requests++;
    return fetcher(...args);
  };
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(Exploration, { ...props, canEdit: false }),
    );
  });
  assert.ok(text(tree).includes('Searching for sources'));
  assert.ok(
    text(tree).includes('Which recipient record explains the difference?'),
  );
  assert.ok(text(tree).includes('Latest captured source:'));
  assert.ok(text(tree).includes('AI · why this check'));
  const link = tree.root
    .findAllByType('a')
    .find((n) => n.props.children === 'Previously captured registry');
  assert.equal(link.props.href, 'https://example.org/captured');
  assert.ok(
    !text(tree).includes('Checking possible meanings and reading sources.'),
  );
  const initialRequests = requests;
  clock = 151;
  await act(async () => {
    t.mock.timers.tick(51);
  });
  assert.ok(!text(tree).includes('Searching for sources'));
  assert.ok(!text(tree).includes('Previously captured registry'));
  assert.doesNotMatch(
    text(tree),
    /why this check|earlier discrepancy|earlier record reports/,
  );
  assert.ok(text(tree).includes('Current activity is not confirmed'));
  assert.equal(requests, initialRequests);
  await act(async () => tree.unmount());
});

test('a delayed response cannot revive work after its conservative validity window', async (t) => {
  const clock = 100;
  t.mock.method(performance, 'now', () => clock);
  const { ResearchActivity } = require(resolve('components/exploration.tsx'));
  const value = episode();
  value.exploration.current_activity = liveActivity();
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(ResearchActivity, {
        state: value.exploration,
        readStartedAt: 10,
      }),
    );
  });
  assert.ok(text(tree).includes('Current activity is not confirmed'));
  assert.ok(!text(tree).includes('Previously captured registry'));
  assert.doesNotMatch(
    text(tree),
    /why this check|earlier discrepancy|earlier record reports/,
  );
  await act(async () => tree.unmount());
});

test('queue, pause, legacy and access changes replace prior working details; finished history has no live activity', async () => {
  const { ResearchActivity, ExplorationBrief } = require(
    resolve('components/exploration.tsx'),
  );
  const value = episode();
  let tree;
  for (const [status, message] of [
    ['waiting', 'Waiting for the next research step'],
    ['paused', 'Research is paused'],
    ['unknown', 'Current activity is not confirmed'],
    ['stale', 'Current activity is not confirmed'],
    ['evidence_changed', 'supporting access or evidence changed'],
  ]) {
    value.exploration.current_activity = { ...liveActivity(), status };
    await act(async () => {
      if (!tree)
        tree = create(
          React.createElement(ResearchActivity, {
            state: value.exploration,
            readStartedAt: performance.now(),
          }),
        );
      else
        tree.update(
          React.createElement(ResearchActivity, {
            state: value.exploration,
            readStartedAt: performance.now(),
          }),
        );
    });
    assert.ok(text(tree).includes(message));
    assert.ok(!text(tree).includes('Previously captured registry'));
    assert.ok(!text(tree).includes('Which recipient record explains'));
    assert.doesNotMatch(
      text(tree),
      /why this check|earlier discrepancy|earlier record reports/,
    );
    assert.equal(tree.root.findAllByType('button').length, 0);
  }
  value.exploration.current_activity = {
    contract: 'research-activity/v1',
    status: 'finished',
  };
  await act(async () =>
    tree.update(
      React.createElement(ResearchActivity, {
        state: value.exploration,
        readStartedAt: null,
      }),
    ),
  );
  assert.equal(tree.toJSON(), null);
  value.exploration.current_activity = liveActivity();
  await act(async () =>
    tree.update(
      React.createElement(ExplorationBrief, { state: value.exploration }),
    ),
  );
  assert.ok(!text(tree).includes('Searching for sources'));
  assert.equal(tree.root.findAllByType('button').length, 0);
  await act(async () => tree.unmount());
});

const recoveryScope = (recovery) => ({
  contract: 'observed-research-scope/v1',
  status: 'ready',
  activity: 'completed',
  searches: { completed: 1, unavailable: 0, interrupted: 0, running: 0 },
  indexes: { completed: 1, unavailable: 0, unknown_searches: 0 },
  reads: { completed: 1, unavailable: 2, interrupted: 0, running: 0 },
  material: {
    sources: 1,
    passages: 1,
    truncated_sources: 0,
    unknown_reader_scope: 0,
  },
  candidates: {
    retrieved: 4,
    not_evaluated: 0,
    evaluation_unavailable: 0,
    selected_not_read: 0,
  },
  questions: { open: 1, not_started: 0 },
  budget_stops: [],
  source_recovery: {
    contract: 'source-recovery/v1',
    status: 'ready',
    failed_reads: 2,
    candidates_checked: 2,
    reads_attempted: 1,
    captures: 1,
    candidate_sets_exhausted: 0,
    unfinished: 0,
    ...recovery,
  },
});

for (const mode of ['captured', 'exhausted', 'budget']) {
  test(`source recovery explains ${mode} without new actions or invented certainty`, async () => {
    const { ExplorationBrief } = require(resolve('components/exploration.tsx'));
    const value = episode();
    const scope = recoveryScope(
      mode === 'captured'
        ? {}
        : {
            reads_attempted: 0,
            captures: 0,
            candidate_sets_exhausted: Number(mode === 'exhausted'),
            unfinished: Number(mode === 'budget'),
          },
    );
    if (mode === 'budget') scope.budget_stops = ['source_fetches'];
    value.exploration.research_scope = scope;
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      throw new Error('History cannot start research');
    };
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(ExplorationBrief, { state: value.exploration }),
      );
    });
    const summary = tree.root.findByProps({ 'aria-label': 'Source recovery' });
    const content = JSON.stringify(
      summary.toJSON ? summary.toJSON() : summary.props.children,
    );
    assert.ok(
      content.includes(
        mode === 'captured'
          ? '1 alternative reading attempt'
          : '0 alternative reading attempts',
      ),
    );
    assert.ok(
      text(tree).includes(
        mode === 'captured' ? '1 alternative source' : '0 alternative sources',
      ),
    );
    assert.equal(
      text(tree).includes('no further candidates'),
      mode === 'exhausted',
    );
    assert.equal(
      text(tree).includes('Alternative checks remain unfinished'),
      mode === 'budget',
    );
    if (mode === 'budget')
      assert.ok(text(tree).includes('source reading budget'));
    assert.equal(tree.root.findAllByType('button').length, 0);
    assert.equal(requests, 0);
    await act(async () => tree.unmount());
  });
}

test('source recovery drops prior counts when access changes and does not invent legacy recovery', async () => {
  const { ExplorationBrief } = require(resolve('components/exploration.tsx'));
  const value = episode();
  let tree;
  for (const status of ['ready', 'unknown', 'evidence_changed']) {
    value.exploration.research_scope =
      status === 'evidence_changed'
        ? { contract: 'observed-research-scope/v1', status }
        : recoveryScope({ status });
    await act(async () => {
      const element = React.createElement(ExplorationBrief, {
        state: value.exploration,
      });
      if (tree) tree.update(element);
      else tree = create(element);
    });
    assert.equal(
      tree.root.findAllByProps({ 'aria-label': 'Source recovery' }).length,
      Number(status === 'ready'),
    );
  }
  await act(async () => tree.unmount());
});

test('only a current alternative receipt explains checking another source and expiry removes it', async (t) => {
  let clock = 100;
  t.mock.method(performance, 'now', () => clock);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { ResearchActivity } = require(resolve('components/exploration.tsx'));
  const value = episode();
  value.exploration.current_activity = {
    ...liveActivity(),
    phase: 'gate',
    checking_alternative: true,
  };
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(ResearchActivity, {
        state: value.exploration,
        readStartedAt: clock,
      }),
    );
  });
  assert.ok(
    text(tree).includes(
      'Checking another source after an earlier page could not be read',
    ),
  );
  clock = 151;
  await act(async () => t.mock.timers.tick(51));
  assert.ok(!text(tree).includes('Checking another source'));
  assert.ok(text(tree).includes('Current activity is not confirmed'));
  await act(async () => tree.unmount());
});

for (const mode of [
  'captured',
  'proposed',
  'unavailable',
  'no_alternative',
  'model_failure',
]) {
  test(`query recovery distinguishes ${mode} and history starts no work`, async () => {
    const { ExplorationBrief } = require(resolve('components/exploration.tsx'));
    const value = episode();
    value.exploration.research_scope = {
      ...recoveryScope(),
      query_recovery: {
        contract: 'query-recovery/v1',
        status: 'ready',
        outcome: mode === 'no_alternative' ? mode : 'proposed',
        original_query: 'Original wording',
        query:
          mode === 'no_alternative' || mode === 'model_failure'
            ? null
            : 'Tentative alternative',
        searches_completed: Number(mode === 'captured'),
        searches_unavailable: Number(mode === 'unavailable'),
        captures: Number(mode === 'captured'),
        unfinished: mode === 'proposed',
        proposal_unavailable: mode === 'model_failure',
      },
    };
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      throw new Error('History cannot start work');
    };
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(ExplorationBrief, { state: value.exploration }),
      );
    });
    assert.equal(
      tree.root.findAllByProps({ 'aria-label': 'Query recovery' }).length,
      1,
    );
    const expected = {
      captured: 'different search wording was checked',
      proposed: 'has not been searched yet',
      unavailable: 'alternative search did not complete',
      no_alternative: 'No distinct alternative',
      model_failure: 'could not be prepared',
    };
    assert.ok(text(tree).includes(expected[mode]));
    assert.ok(text(tree).includes('Your original question is unchanged'));
    assert.equal(
      text(tree).includes('Alternative wording (unconfirmed)'),
      !['no_alternative', 'model_failure'].includes(mode),
    );
    assert.equal(tree.root.findAllByType('button').length, 0);
    assert.equal(requests, 0);
    await act(async () => tree.unmount());
  });
}

test('revoked and legacy research never display alternate wording', async () => {
  const { ExplorationBrief } = require(resolve('components/exploration.tsx'));
  for (const status of ['unknown', 'evidence_changed']) {
    const value = episode();
    value.exploration.research_scope = {
      contract: 'observed-research-scope/v1',
      status,
    };
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(ExplorationBrief, { state: value.exploration }),
      );
    });
    assert.equal(
      tree.root.findAllByProps({ 'aria-label': 'Query recovery' }).length,
      0,
    );
    await act(async () => tree.unmount());
  }
});

test('alternate searching is tied to a current receipt and disappears at expiry', async (t) => {
  let clock = 100;
  t.mock.method(performance, 'now', () => clock);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { ResearchActivity } = require(resolve('components/exploration.tsx'));
  const value = episode();
  value.exploration.current_activity = {
    ...liveActivity(),
    testing_query: true,
  };
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(ResearchActivity, {
        state: value.exploration,
        readStartedAt: clock,
      }),
    );
  });
  assert.ok(text(tree).includes('Testing an alternative wording'));
  clock = 151;
  await act(async () => t.mock.timers.tick(51));
  assert.ok(!text(tree).includes('Testing an alternative wording'));
  await act(async () => tree.unmount());
});

for (const category of [
  'direct',
  'context',
  'counterevidence',
  'unrelated',
  'uncertain',
]) {
  test(`read relevance shows ${category} as AI assessment with retained passage`, async () => {
    const { ExplorationBrief } = require(resolve('components/exploration.tsx'));
    const value = episode();
    const source = value.exploration.sources[0];
    value.exploration.research_scope = {
      ...recoveryScope(),
      read_relevance: {
        contract: 'read-relevance/v1',
        status: 'ready',
        assessments: [
          {
            source_id: source.id,
            question_id: 'q1',
            question: 'Which entity is described?',
            category,
            reason: 'The passage names a different legal entity.',
            quote: 'Exact retained passage.',
            locator: 'p1',
            limitations: ['entity', 'jurisdiction', 'date', 'incomplete'],
          },
        ],
        unassessed: 1,
        alternative_reads: Number(category === 'unrelated'),
        unfinished: Number(category === 'unrelated'),
      },
    };
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      throw new Error('History must be read-only');
    };
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(ExplorationBrief, { state: value.exploration }),
      );
    });
    const copy = text(tree);
    assert.ok(copy.includes('AI assessed relevance for 1 captured source'));
    assert.ok(
      copy.includes('AI assessments of captured passages, not human review'),
    );
    assert.ok(copy.includes('No assessment does not mean irrelevant'));
    assert.ok(copy.includes('The source remains saved'));
    assert.ok(
      copy.includes(
        '1 captured source has no validated relevance assessment yet',
      ),
    );
    assert.ok(copy.includes('The captured passages are incomplete'));
    assert.equal(
      copy.includes('additional reading attempts followed'),
      category === 'unrelated',
    );
    assert.ok(
      tree.root
        .findAllByType('blockquote')
        .some((n) => n.children.includes('Exact retained passage.')),
    );
    const details = tree.root
      .findAllByType('details')
      .find(
        (n) =>
          n.findAllByProps({ 'aria-label': 'Relevance of read sources' })
            .length > 0,
      );
    assert.ok(details && !details.props.open);
    assert.equal(requests, 0);
    assert.equal(tree.root.findAllByType('button').length, 0);
    await act(async () => tree.unmount());
  });
}

test('legacy, revoked and absent source assessment details remain hidden', async () => {
  const { ExplorationBrief } = require(resolve('components/exploration.tsx'));
  for (const status of ['unknown', 'evidence_changed']) {
    const value = episode();
    value.exploration.research_scope = {
      contract: 'observed-research-scope/v1',
      status,
    };
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(ExplorationBrief, { state: value.exploration }),
      );
    });
    assert.equal(
      tree.root.findAllByProps({ 'aria-label': 'Read relevance summary' })
        .length,
      0,
    );
    assert.equal(
      tree.root.findAllByProps({ 'aria-label': 'Relevance of read sources' })
        .length,
      0,
    );
    await act(async () => tree.unmount());
  }
});

for (const mode of ['mixed', 'unassessed', 'history', 'legacy', 'revoked']) {
  test(`early preparation describes the saved checkpoint without new work: ${mode}`, async () => {
    const value = episode();
    value.exploration.orientation = orientation();
    if (mode !== 'legacy') {
      value.exploration.orientation.briefing.read_preparation = {
        contract: 'read-informed-research/v1',
        assessed_sources: mode === 'unassessed' ? 0 : 1,
        unassessed_sources: mode === 'unassessed' ? 2 : 1,
      };
    }
    if (mode === 'revoked') {
      value.exploration.orientation.status = 'evidence_changed';
      value.exploration.orientation.briefing = null;
    }
    // Today's later assessment counts must not rewrite the saved early snapshot.
    value.exploration.research_scope = { status: 'unknown' };
    serve(value, () => {
      throw new Error('Reading starts no new work');
    });
    let tree;
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, {
            ...props,
            historical: mode === 'history',
            canEdit: false,
          }),
        );
      });
      const note = tree.root
        .findAllByType('summary')
        .find(
          (item) =>
            item.children.join('') === 'How this first reading was prepared',
        );
      if (mode === 'legacy' || mode === 'revoked') {
        assert.equal(note, undefined);
        assert.doesNotMatch(text(tree), /with an AI relevance assessment/);
      } else {
        assert.ok(note);
        assert.notEqual(note.parent.props.open, true);
        assert.match(
          text(tree),
          mode === 'unassessed'
            ? /0 sources with an AI relevance assessment. 2 sources were still unassessed/
            : /1 source with an AI relevance assessment. 1 source was still unassessed/,
        );
        assert.match(text(tree), /available at this checkpoint/);
        assert.equal(tree.root.findAllByType('form').length, 0);
      }
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });
}

for (const mode of ['current', 'history', 'changed'])
  test(`ordinary open question preserves source context without inventing reinterpretation: ${mode}`, async () => {
    let tree;
    const writes = [];
    const value = episode();
    const check = { ...savedCheck(), basis: 'open_question' };
    check.why = check.purpose;
    value.exploration.changes = [];
    if (mode === 'current') value.exploration.next_check = check;
    else {
      value.exploration.next_check = null;
      value.exploration.continuation =
        mode === 'history'
          ? { status: 'ready', ...check }
          : { status: 'evidence_changed' };
    }
    serve(value, (url, init) => {
      writes.push({ url, body: JSON.parse(init.body) });
      return Response.json(value);
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, {
            ...props,
            canEdit: mode === 'current',
          }),
        );
      });
      assert.equal(writes.length, 0);
      if (mode === 'current') {
        assert.match(text(tree), /An open question to investigate/);
        assert.match(
          text(tree),
          /Read a reconciliation of awards and payments/,
        );
        assert.equal(
          tree.root
            .findAllByType('button')
            .filter((b) => b.props.children === 'Continue this check').length,
          1,
        );
        await act(async () =>
          findButton(tree, 'Continue this check').props.onClick(),
        );
        assert.equal(writes.length, 1);
        assert.equal(writes[0].body.follow_up_id, check.question_id);
        assert.equal(writes[0].body.question, check.question);
        assert.equal(writes[0].body.basis, undefined);
      } else {
        assert.equal(findButton(tree, 'Continue this check'), undefined);
        if (mode === 'history') {
          assert.match(
            text(tree),
            /Your selected open question · earlier research context/,
          );
          assert.match(
            text(tree),
            /earlier source reported a different amount/,
          );
        } else
          assert.doesNotMatch(
            text(tree),
            /earlier source reported a different amount/,
          );
      }
      assert.doesNotMatch(text(tree), /earlier meaning.*changed/i);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const mode of ['current', 'history', 'unknown', 'changed', 'missing'])
  test(`question checkpoints separate captured material from an answer: ${mode}`, async () => {
    let tree;
    const writes = [];
    const value = episode();
    value.exploration.briefing.clarification = '';
    value.exploration.briefing.directions = [];
    const check = { ...savedCheck(), basis: 'further_question' };
    if (mode !== 'missing')
      value.exploration.question_assessments =
        mode === 'unknown' || mode === 'changed'
          ? {
              contract: 'branch-question-assessment/v1',
              status: mode === 'changed' ? 'evidence_changed' : 'unknown',
            }
          : {
              contract: 'branch-question-assessment/v1',
              status: 'ready',
              unassessed: 1,
              assessments: [
                {
                  question_id: check.question_id,
                  question: check.question,
                  status: 'partial',
                  points: [
                    {
                      statement: 'Only part of the question is covered.',
                      evidence: [
                        {
                          source_id: 's',
                          quote: 'The source passage is here.',
                          locator: 'p1',
                          role: 'context',
                        },
                      ],
                    },
                  ],
                  limitations: ['The later period has not been checked.'],
                },
              ],
            };
    if (mode === 'current') value.exploration.next_check = check;
    serve(value, (url, init) => {
      writes.push({ url, body: JSON.parse(init.body) });
      return Response.json(value);
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, {
            ...props,
            historical: mode === 'history',
            canEdit: mode === 'current',
          }),
        );
      });
      assert.equal(writes.length, 0);
      const summary = tree.root
        .findAllByType('summary')
        .find(
          (s) => s.children.join('') === 'Research checkpoints by question',
        );
      if (mode === 'current' || mode === 'history') {
        assert.ok(summary);
        assert.notEqual(summary.parent.props.open, true);
        assert.match(text(tree), /Some evidence; the question remains open/);
        assert.match(
          text(tree),
          /1 completed question has no validated answer assessment/,
        );
        assert.match(text(tree), /The later period has not been checked/);
        assert.equal(
          tree.root.findAllByType('form').length,
          mode === 'current' ? 1 : 0,
        );
      } else assert.equal(summary, undefined);
      if (mode === 'current') {
        assert.match(text(tree), /Another way to investigate this question/);
        assert.equal(
          tree.root
            .findAllByType('button')
            .filter((b) => b.props.children === 'Continue this check').length,
          1,
        );
        await act(async () =>
          findButton(tree, 'Continue this check').props.onClick(),
        );
        assert.equal(writes.length, 1);
        assert.equal(writes[0].body.follow_up_id, check.question_id);
        assert.equal(writes[0].body.question, check.question);
      } else assert.equal(findButton(tree, 'Continue this check'), undefined);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

test('later public evidence retires an old checkpoint without inventing a new answer', async () => {
  let tree;
  const value = episode();
  value.exploration.question_assessments = {
    contract: 'branch-question-assessment/v1',
    status: 'ready',
    assessments: [],
    unassessed: 0,
    outdated: 1,
  };
  serve(value, () => {
    throw new Error('Reading must not start work');
  });
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.match(
      text(tree),
      /Earlier assessments changed with new public evidence and need a fresh review/,
    );
    assert.doesNotMatch(text(tree), /Some evidence; the question remains open/);
    assert.equal(findButton(tree, 'Continue this check'), undefined);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

for (const mode of ['current', 'history', 'changed', 'old'])
  test(`renewed question keeps a readable earlier checkpoint: ${mode}`, async () => {
    let tree;
    const value = episode();
    const a = {
      question_id: 'q-renewed',
      question: 'Which amount was reported?',
      status: 'conflicting',
      points: [
        {
          statement: 'Later evidence reports another amount.',
          evidence: [
            {
              source_id: 's',
              quote: 'The source passage is here.',
              locator: 'p1',
              role: 'counterevidence',
            },
          ],
        },
      ],
      limitations: ['The discrepancy remains unresolved.'],
      stage: 'final_briefing',
      earlier: [
        {
          status: 'partial',
          points: [
            {
              statement: 'Earlier only one report was available.',
              evidence: [
                {
                  source_id: 's',
                  quote: 'The source passage is here.',
                  locator: 'p1',
                  role: 'support',
                },
              ],
            },
          ],
          limitations: ['The recipient was not yet checked.'],
        },
      ],
    };
    if (mode === 'old') {
      delete a.stage;
      delete a.earlier;
    }
    value.exploration.question_assessments =
      mode === 'changed'
        ? {
            contract: 'branch-question-assessment/v1',
            status: 'evidence_changed',
          }
        : {
            contract: 'branch-question-assessment/v1',
            status: 'ready',
            unassessed: 0,
            assessments: [a],
          };
    serve(value, () => {
      throw new Error('Opening assessment history must not start work');
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, {
            ...props,
            canEdit: false,
            historical: mode === 'history',
          }),
        );
      });
      if (mode === 'current' || mode === 'history') {
        assert.match(text(tree), /Updated in the research summary/);
        assert.match(text(tree), /Later evidence reports another amount/);
        assert.match(text(tree), /Earlier only one report was available/);
        const summary = tree.root
          .findAllByType('summary')
          .find((s) => s.children.join('') === 'Earlier assessment');
        assert.ok(summary);
        assert.notEqual(summary.parent.props.open, true);
        assert.equal(
          tree.root
            .findAllByType('h4')
            .filter((h) => h.children.join('') === a.question).length,
          1,
        );
      } else
        assert.doesNotMatch(
          text(tree),
          /Updated in the research summary|Earlier only one report/,
        );
      assert.equal(tree.root.findAllByType('form').length, 0);
      assert.equal(findButton(tree, 'Continue this check'), undefined);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const mode of [
  'current',
  'history',
  'selected',
  'missing',
  'changed',
  'unavailable',
])
  test(`optional question update failure keeps a quiet summary reader: ${mode}`, async () => {
    let tree;
    const value = episode();
    if (mode !== 'missing')
      value.exploration.briefing.question_updates = { status: 'unavailable' };
    if (mode === 'selected')
      value.exploration.briefing.assessment = {
        question_id: 'selected-q',
        question: 'Which amount is documented?',
        status: 'partial',
        points: [
          {
            statement: 'The selected answer remains available.',
            evidence: [
              {
                source_id: 's',
                quote: 'The source passage is here.',
                locator: 'p1',
                role: 'support',
              },
            ],
          },
        ],
        limitations: ['Other material is unchecked.'],
      };
    if (mode === 'changed' || mode === 'unavailable') {
      value.exploration.status =
        mode === 'changed' ? 'evidence_changed' : 'unavailable';
      value.exploration.briefing = null;
    }
    let writes = 0;
    serve(value, () => {
      writes++;
      throw new Error('Reading must not start work');
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, {
            ...props,
            canEdit: false,
            historical: mode === 'history',
          }),
        );
      });
      const visible = ['current', 'history', 'selected'].includes(mode);
      const notices = tree.root
        .findAllByType('p')
        .filter((p) =>
          p.children
            .join('')
            .includes('Question assessments could not be updated.'),
        );
      assert.equal(notices.length, visible ? 1 : 0);
      if (visible) {
        assert.match(text(tree), /earlier assessments remain unchanged/);
        assert.match(text(tree), /The source passage is here/);
        assert.ok(
          tree.root
            .findAllByType('a')
            .some((a) => a.props.href === 'https://example.org/record'),
        );
      }
      if (mode === 'selected')
        assert.match(text(tree), /The selected answer remains available/);
      assert.equal(writes, 0);
      assert.equal(tree.root.findAllByType('form').length, 0);
      assert.equal(findButton(tree, 'Continue this check'), undefined);
      assert.doesNotMatch(
        text(tree),
        /PRIVATE INVALID|_renewal_unavailable|question_renewals/,
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

function savedUpdateEpisode(status = 'running') {
  const value = episode({ status });
  value.exploration.status = 'exploring';
  value.exploration.briefing = null;
  value.exploration.orientation = orientation();
  value.exploration.research_update = {
    contract: 'question-research-update/v1',
    question_id: 'q-update',
    event_sequence: 12,
    saved_at: '2026-09-30T08:00:00Z',
  };
  value.exploration.question_assessments = {
    contract: 'branch-question-assessment/v1',
    status: 'ready',
    unassessed: 0,
    assessments: [
      {
        question_id: 'q-update',
        question: 'Which part of this question is supported?',
        status: 'conflicting',
        points: [
          {
            statement: 'The read accounts disagree about the reported scope.',
            evidence: [
              {
                source_id: 's',
                quote: 'The source passage is here.',
                locator: 'p1',
                role: 'support',
              },
              {
                source_id: 's',
                quote: 'A different retained passage.',
                locator: 'p2',
                role: 'counterevidence',
              },
            ],
          },
        ],
        limitations: ['The wider context still needs investigation.'],
      },
    ],
  };
  return value;
}

for (const mode of ['running', 'paused', 'cancelled', 'history'])
  test(`saved research update promotes one cited assessment without invented activity: ${mode}`, async () => {
    const value = savedUpdateEpisode(mode === 'history' ? 'cancelled' : mode);
    value.exploration.current_activity = {
      contract: 'research-activity/v1',
      status: mode === 'paused' ? 'paused' : 'finished',
    };
    serve(value, () => {
      throw new Error('Reading must not start work');
    });
    let tree;
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, {
            ...props,
            canEdit: false,
            historical: mode === 'history',
          }),
        );
      });
      assert.match(text(tree), /AI · saved research update/);
      assert.match(
        text(tree),
        /Conflicting evidence; the question remains open/,
      );
      assert.match(text(tree), /Supporting passage/);
      assert.match(text(tree), /Counterevidence/);
      assert.match(text(tree), /The wider context still needs investigation/);
      assert.equal(
        tree.root
          .findAllByType('h3')
          .filter(
            (x) =>
              x.props.children === 'Which part of this question is supported?',
          ).length,
        1,
      );
      assert.equal(
        tree.root
          .findAllByType('h4')
          .filter(
            (x) =>
              x.props.children === 'Which part of this question is supported?',
          ).length,
        0,
      );
      assert.ok(
        tree.root
          .findAllByType('a')
          .some((x) => x.props.href === 'https://example.org/record'),
      );
      const earlier = tree.root
        .findAllByType('summary')
        .find((x) => x.props.children === 'Earlier research context');
      assert.ok(earlier);
      assert.notEqual(earlier.parent.props.open, true);
      assert.equal(tree.root.findAllByType('form').length, 0);
      assert.doesNotMatch(
        text(tree),
        /Research checkpoints by question|Searching for sources/,
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const invalid of [
  'legacy',
  'unknown_contract',
  'wrong_question',
  'bad_time',
  'bad_order',
  'changed',
  'missing_source',
])
  test(`saved research update never promotes unknown or stale context: ${invalid}`, async () => {
    const value = savedUpdateEpisode();
    if (invalid === 'legacy') delete value.exploration.research_update;
    if (invalid === 'unknown_contract')
      value.exploration.research_update.contract = 'unknown';
    if (invalid === 'wrong_question')
      value.exploration.research_update.question_id = 'unrelated';
    if (invalid === 'bad_time')
      value.exploration.research_update.saved_at = 'not a date';
    if (invalid === 'bad_order')
      value.exploration.research_update.event_sequence = 0;
    if (invalid === 'changed')
      value.exploration.question_assessments = {
        contract: 'branch-question-assessment/v1',
        status: 'evidence_changed',
      };
    if (invalid === 'missing_source') value.exploration.sources = [];
    serve(value, () => {
      throw new Error('Reading must not start work');
    });
    let tree;
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, { ...props, canEdit: false }),
        );
      });
      assert.doesNotMatch(
        text(tree),
        /AI · saved research update|Earlier research context/,
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

test('saved research update yields to final summary and returns only when an available finding remains', async () => {
  const { ExplorationBrief } = require(resolve('components/exploration.tsx'));
  const value = savedUpdateEpisode();
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(ExplorationBrief, { state: value.exploration }),
      );
    });
    assert.match(text(tree), /AI · saved research update/);
    const ready = {
      ...value.exploration,
      status: 'ready',
      briefing: episode().exploration.briefing,
    };
    await act(async () => {
      tree.update(React.createElement(ExplorationBrief, { state: ready }));
    });
    assert.doesNotMatch(
      text(tree),
      /AI · saved research update|Earlier research context/,
    );
    assert.match(text(tree), /An AI interpretation/);
    assert.match(text(tree), /Research checkpoints by question/);
    const unavailable = { ...value.exploration, status: 'unavailable' };
    await act(async () => {
      tree.update(
        React.createElement(ExplorationBrief, { state: unavailable }),
      );
    });
    assert.match(text(tree), /AI · saved research update/);
    await act(async () => {
      tree.update(
        React.createElement(ExplorationBrief, {
          state: { ...unavailable, status: 'evidence_changed' },
        }),
      );
    });
    assert.doesNotMatch(
      text(tree),
      /AI · saved research update|The read accounts disagree/,
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('saved research update polling retains identity and rejects late reads after a newer finding or denial', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const value = savedUpdateEpisode();
  serve(value, () => {
    throw new Error('Polling must not write');
  });
  const initialFetch = globalThis.fetch;
  let defer = false;
  const pending = [];
  globalThis.fetch = (url, init) =>
    defer && url === `${base}/r`
      ? new Promise((resolve) => pending.push(resolve))
      : initialFetch(url, init);
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    const section = () =>
      tree.root
        .findAllByType('section')
        .find((x) =>
          x
            .findAllByType('h3')
            .some(
              (h) =>
                h.props.children ===
                'Which part of this question is supported?',
            ),
        );
    const savedNode = section();
    defer = true;
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => pending[0](Response.json(value)));
    assert.strictEqual(section(), savedNode);
    assert.equal(
      savedNode.findAll((x) => x.props['aria-live'] || x.props.autoFocus)
        .length,
      0,
    );
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => t.mock.timers.tick(10000));
    const newer = structuredClone(value);
    newer.revision++;
    newer.exploration.research_update.event_sequence = 25;
    newer.exploration.question_assessments.assessments[0].points[0].statement =
      'A later supported checkpoint.';
    await act(async () => pending[2](Response.json(newer)));
    await act(async () => pending[1](Response.json(value)));
    assert.match(text(tree), /A later supported checkpoint/);
    assert.doesNotMatch(text(tree), /The read accounts disagree/);
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => pending[4](Response.json({}, { status: 403 })));
    await act(async () => pending[3](Response.json(newer)));
    assert.doesNotMatch(
      text(tree),
      /AI · saved research update|A later supported checkpoint/,
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

for (const kind of ['planned', 'source_follow_up'])
  test(`current purpose distinguishes AI rationale and its optional trigger: ${kind}`, async (t) => {
    t.mock.method(performance, 'now', () => 100);
    const { ResearchActivity } = require(resolve('components/exploration.tsx'));
    const value = episode().exploration;
    value.current_activity = liveActivity();
    value.current_activity.purpose.kind = kind;
    if (kind === 'planned') delete value.current_activity.purpose.trigger;
    let tree;
    try {
      await act(async () => {
        tree = create(
          React.createElement(ResearchActivity, {
            state: value,
            readStartedAt: 100,
          }),
        );
      });
      assert.match(text(tree), /AI · why this check/);
      assert.match(text(tree), /Check whether the recipient/);
      assert.match(text(tree), /Latest captured source/);
      const details = tree.root.findAllByType('details');
      assert.equal(details.length, kind === 'planned' ? 0 : 1);
      if (kind !== 'planned') {
        assert.ok(!details[0].props.open);
        assert.equal(
          details[0].findByType('blockquote').props.children,
          livePurpose().trigger.quote,
        );
        assert.equal(
          details[0].findByType('a').props.href,
          'https://example.org/trigger',
        );
        assert.match(text(tree), /does not settle the question/);
      }
      assert.equal(tree.root.findAllByType('button').length, 0);
      assert.ok(
        tree.root
          .findAllByType('output')
          .every((node) => !node.findAllByType('p').length),
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const invalid of [
  'missing',
  'unknown_contract',
  'unknown_kind',
  'empty',
  'oversized',
  'missing_quote',
  'missing_source',
])
  test(`current purpose omits unverifiable metadata without hiding actual activity: ${invalid}`, async (t) => {
    t.mock.method(performance, 'now', () => 100);
    const { ResearchActivity } = require(resolve('components/exploration.tsx'));
    const value = episode().exploration;
    value.current_activity = liveActivity();
    const purpose = value.current_activity.purpose;
    if (invalid === 'missing') delete value.current_activity.purpose;
    if (invalid === 'unknown_contract') purpose.contract = 'unknown';
    if (invalid === 'unknown_kind') purpose.kind = 'unconfirmed';
    if (invalid === 'empty') purpose.text = ' ';
    if (invalid === 'oversized') purpose.text = 'x'.repeat(501);
    if (invalid === 'missing_quote') delete purpose.trigger.quote;
    if (invalid === 'missing_source') delete purpose.trigger.source;
    let tree;
    try {
      await act(async () => {
        tree = create(
          React.createElement(ResearchActivity, {
            state: value,
            readStartedAt: 100,
          }),
        );
      });
      assert.match(text(tree), /Searching for sources/);
      assert.doesNotMatch(
        text(tree),
        /AI · why this check|earlier discrepancy|earlier record reports|Passage behind/,
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

test('current purpose polling drops an older explanation and cannot revive it after denied access', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  t.mock.method(performance, 'now', () => 100);
  const value = episode({ status: 'running' });
  value.exploration.status = 'exploring';
  value.exploration.briefing = null;
  value.exploration.current_activity = {
    ...liveActivity(),
    valid_for_ms: 90000,
  };
  serve(value, () => {
    throw new Error('Reading purpose must not start work');
  });
  const initialFetch = globalThis.fetch;
  let defer = false;
  const pending = [];
  globalThis.fetch = (url, init) =>
    defer && url === `${base}/r`
      ? new Promise((resolve) => pending.push(resolve))
      : initialFetch(url, init);
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.match(text(tree), /earlier discrepancy/);
    defer = true;
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => t.mock.timers.tick(10000));
    const newer = structuredClone(value);
    newer.revision++;
    newer.exploration.current_activity.purpose.text =
      'Check the later retained recipient account.';
    await act(async () => pending[1](Response.json(newer)));
    await act(async () => pending[0](Response.json(value)));
    assert.match(text(tree), /later retained recipient account/);
    assert.doesNotMatch(text(tree), /earlier discrepancy/);
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => pending[3](Response.json({}, { status: 403 })));
    await act(async () => pending[2](Response.json(newer)));
    assert.doesNotMatch(
      text(tree),
      /why this check|later retained recipient account|earlier record reports/,
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

function earlyChoiceEpisode(status = 'running') {
  const value = episode({ status });
  value.exploration.status = 'exploring';
  const directions = value.exploration.briefing.directions;
  value.exploration.briefing = null;
  value.exploration.orientation = orientation();
  Object.assign(value.exploration.orientation.briefing, {
    clarification: 'Verify identity or investigate the surrounding context?',
    directions,
  });
  return value;
}

test('an early choice continues atomically with its exact question and evidence pin', async () => {
  const value = earlyChoiceEpisode();
  const writes = [];
  let tree;
  serve(value, async (url, init) => {
    writes.push({ url, body: JSON.parse(init.body) });
    return Response.json({ id: 'next' });
  });
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    assert.equal(writes.length, 0);
    assert.match(text(tree), /Without a reply, the current research continues/);
    assert.equal(tree.root.findAllByType('form').length, 1);
    await act(async () =>
      findButton(tree, 'Check the entity in the register.').props.onClick(),
    );
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, `${base}/r/exploration/reply`);
    assert.deepEqual(writes[0].body, {
      request_key: writes[0].body.request_key,
      expected_revision: 18,
      question: 'Check the entity in the register.',
      direction: 0,
      orientation_revision: 12,
      public_query_confirmed: true,
      continue_research: true,
    });
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('an uncertain handoff retries the same request without a separate pause', async () => {
  const value = earlyChoiceEpisode();
  const writes = [];
  let tree;
  serve(value, async (url, init) => {
    writes.push({ url, body: JSON.parse(init.body) });
    if (writes.length === 1) throw new Error('Lost reply');
    return Response.json({ id: 'next' });
  });
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    await act(async () =>
      findButton(tree, 'Check the entity in the register.').props.onClick(),
    );
    await act(async () =>
      findButton(tree, 'Retry this direction safely').props.onClick(),
    );
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0], writes[1]);
    assert.ok(writes.every((w) => w.url.endsWith('/exploration/reply')));
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

for (const failure of ['conflict', 'lost'])
  test(`failed handoff does not issue a separate pause: ${failure}`, async () => {
    const value = earlyChoiceEpisode();
    const writes = [];
    let tree;
    serve(value, async (url, init) => {
      writes.push({ url, body: JSON.parse(init.body) });
      if (failure === 'lost') throw new Error('Lost response');
      return Response.json({ message: 'Checkpoint changed' }, { status: 409 });
    });
    try {
      await act(async () => {
        tree = create(React.createElement(Exploration, props));
      });
      await act(async () =>
        findButton(tree, 'Check the entity in the register.').props.onClick(),
      );
      assert.equal(writes.length, 1);
      assert.equal(writes[0].url, `${base}/r/exploration/reply`);
      assert.equal(
        !!findButton(tree, 'Retry this direction safely'),
        failure === 'lost',
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

test('a session change discards handoff completion from the old session', async () => {
  const writes = [];
  let tree,
    release,
    changed = 0;
  const originalWindow = globalThis.window;
  const handlers = new Map();
  globalThis.window = {
    addEventListener: (k, fn) =>
      handlers.set(k, [...(handlers.get(k) || []), fn]),
    removeEventListener() {},
  };
  serve(earlyChoiceEpisode(), async (url, init) => {
    writes.push({ url, body: JSON.parse(init.body) });
    return new Promise((resolve) => {
      release = resolve;
    });
  });
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
    });
    await act(async () => {
      for (const fn of handlers.get('helvetic-session-changed') || []) fn();
    });
    await act(async () => release(Response.json({ id: 'next' })));
    assert.equal(writes.length, 1);
    assert.equal(changed, 0);
    assert.ok(!findButton(tree, 'Retry this direction safely'));
  } finally {
    if (tree) await act(async () => tree.unmount());
    globalThis.window = originalWindow;
  }
});

for (const unavailable of [
  'evidence_changed',
  'missing_source',
  'unavailable',
  'no_fork',
  'read_only',
  'final',
])
  test(`early choices are unavailable for ${unavailable}`, async () => {
    const value = earlyChoiceEpisode();
    let tree;
    if (unavailable === 'evidence_changed')
      value.exploration.status = 'evidence_changed';
    if (unavailable === 'missing_source') value.exploration.sources = [];
    if (unavailable === 'unavailable')
      value.exploration.orientation.status = 'unavailable';
    if (unavailable === 'no_fork')
      value.exploration.orientation.briefing.directions = [];
    if (unavailable === 'final') {
      value.status = 'completed';
      value.exploration.status = 'ready';
      value.exploration.briefing = episode().exploration.briefing;
    }
    serve(value, () => {
      throw new Error('No automatic action');
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, {
            ...props,
            canEdit: unavailable !== 'read_only',
          }),
        );
      });
      assert.doesNotMatch(
        text(tree),
        /Verify identity or investigate the surrounding context/,
      );
      if (unavailable === 'final')
        assert.match(text(tree), /Which outcome matters most/);
      else assert.ok(!findButton(tree, 'Check the entity in the register.'));
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const checkpoint of ['early', 'before_first_result'])
  test(`own words continue research with context: ${checkpoint}`, async () => {
    const value = earlyChoiceEpisode();
    if (checkpoint === 'before_first_result') {
      value.exploration.orientation = undefined;
      value.exploration.sources = [];
      value.exploration.revision = 0;
    }
    const writes = [];
    let tree;
    serve(value, async (url, init) => {
      writes.push({ url, body: JSON.parse(init.body) });
      return Response.json({ message: 'Checkpoint changed' }, { status: 409 });
    });
    try {
      await act(async () => {
        tree = create(React.createElement(Exploration, props));
      });
      assert.match(
        text(tree),
        /Earlier public searches and sources are kept as context/,
      );
      await act(async () =>
        tree.root.findByType('textarea').props.onChange({
          target: { value: 'I meant a different foundation.' },
        }),
      );
      await act(async () =>
        tree.root.findByType('form').props.onSubmit({ preventDefault() {} }),
      );
      assert.equal(writes.length, 1);
      assert.equal(writes[0].url, `${base}/r/exploration/reply`);
      assert.equal(
        writes[0].body.expected_revision,
        value.exploration.revision,
      );
      assert.equal(writes[0].body.question, 'I meant a different foundation.');
      assert.equal(writes[0].body.continue_research, true);
      assert.ok(!('orientation_revision' in writes[0].body));
      assert.ok(!('direction' in writes[0].body));
      assert.equal(
        tree.root.findByType('textarea').props.value,
        'I meant a different foundation.',
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const outcome of [
  'possible_answer',
  'partial',
  'conflicting',
  'not_found',
])
  for (const historical of [false, true])
    test(`chosen early direction uses one cited primary answer: ${outcome}/${historical}`, async () => {
      const value = episode();
      value.question =
        'Which recipient record supports the selected direction?';
      value.exploration.briefing.assessment = {
        contract: 'selected-direction-assessment/v1',
        selection: {
          investigation_id: 'earlier',
          orientation_revision: 8,
          direction_index: 1,
        },
        investigation_id: value.id,
        selected_from_investigation_id: 'earlier',
        question: value.question,
        status: outcome,
        points: [
          {
            statement: 'The captured record leaves the wider question open.',
            evidence: [
              {
                source_id: 's',
                quote: 'The source passage is here.',
                locator: 'p1',
                role: outcome === 'not_found' ? 'context' : 'support',
              },
            ],
          },
        ],
        limitations: ['Other periods remain unchecked.'],
      };
      let tree,
        writes = 0;
      serve(value, () => {
        writes++;
        throw new Error('Reading must not create work');
      });
      try {
        await act(async () => {
          tree = create(
            React.createElement(Exploration, {
              ...props,
              canEdit: false,
              historical,
            }),
          );
        });
        assert.equal(
          tree.root.findAllByProps({
            'aria-label': 'Assessment of your question',
          }).length,
          1,
        );
        assert.equal(
          tree.root
            .findAllByType('p')
            .filter((p) => p.children.join('') === value.question).length,
          1,
        );
        assert.match(text(tree), /What the evidence says about your question/);
        assert.match(text(tree), /Other periods remain unchecked/);
        const background = tree.root
          .findAllByType('details')
          .find((d) =>
            d
              .findAllByType('summary')
              .some(
                (s) =>
                  s.children.join('') ===
                  'Research context & earlier understanding',
              ),
          );
        assert.ok(background && !background.props.open);
        const quote = tree.root
          .findAllByType('details')
          .find((d) =>
            d
              .findAllByType('summary')
              .some(
                (s) =>
                  s.children.join('') === 'Read the evidence for this point',
              ),
          );
        assert.ok(quote && !quote.props.open);
        assert.ok(
          quote
            .findAllByType('a')
            .some((a) => a.props.href === 'https://example.org/record'),
        );
        assert.equal(tree.root.findAllByType('form').length, 0);
        assert.equal(writes, 0);
      } finally {
        if (tree) await act(async () => tree.unmount());
      }
    });

for (const mode of ['missing', 'unavailable', 'changed'])
  test(`selected direction answer recovery preserves honest summary: ${mode}`, async () => {
    const value = episode();
    if (mode !== 'missing')
      value.exploration.briefing.selected_direction_assessment = {
        status: 'unavailable',
      };
    if (mode === 'changed') {
      value.exploration.status = 'evidence_changed';
      value.exploration.briefing = null;
    }
    let tree;
    serve(value, () => {
      throw new Error('No recovery inference from the reader');
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, { ...props, canEdit: false }),
        );
      });
      if (mode === 'unavailable') {
        assert.match(text(tree), /An answer to your question is unavailable/);
        assert.match(text(tree), /An AI interpretation/);
        assert.match(text(tree), /The source passage is here/);
      } else
        assert.doesNotMatch(
          text(tree),
          /An answer to your question is unavailable/,
        );
      assert.equal(
        tree.root.findAllByProps({
          'aria-label': 'Assessment of your question',
        }).length,
        0,
      );
      assert.equal(tree.root.findAllByType('form').length, 0);
      assert.doesNotMatch(
        text(tree),
        /INVALID OPTIONAL|direction_assessment_context/,
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

const answerLinkedEpisode = (status = 'partial') => {
  const value = episode();
  const limitation =
    'Independent recipient records for other periods remain unchecked.';
  value.exploration.briefing.assessment = {
    contract: 'selected-direction-assessment/v1',
    selection: {
      investigation_id: 'earlier',
      orientation_revision: 8,
      direction_index: 0,
    },
    investigation_id: value.id,
    selected_from_investigation_id: 'earlier',
    question: value.question,
    status,
    points: [],
    limitations: [limitation],
  };
  value.exploration.next_check = {
    ...savedCheck(),
    answer_link: {
      contract: 'selected-direction-next-check/v1',
      question: value.question,
      limitation_index: 0,
      limitation,
    },
  };
  return value;
};

for (const outcome of ['partial', 'conflicting', 'not_found'])
  test(`answer-linked next check retains one exact explicit action: ${outcome}`, async () => {
    const value = answerLinkedEpisode(outcome);
    const writes = [];
    let tree;
    serve(value, async (url, init) => {
      writes.push(JSON.parse(init.body));
      return Response.json({ id: 'next' });
    });
    try {
      await act(async () => {
        tree = create(React.createElement(Exploration, props));
      });
      assert.match(text(tree), /AI · connection to your answer/);
      const card = tree.root
        .findAllByType('article')
        .find((a) =>
          a
            .findAllByType('button')
            .some((b) => b.props.children === 'Continue this check'),
        );
      assert.ok(card);
      assert.ok(
        card
          .findAllByType('p')
          .some((p) => p.children.includes('To investigate: ')),
      );
      assert.ok(
        card
          .findAllByType('p')
          .some((p) =>
            p.children.includes(
              value.exploration.next_check.answer_link.limitation,
            ),
          ),
      );
      assert.equal(
        tree.root
          .findAllByType('button')
          .filter((b) => b.props.children === 'Continue this check').length,
        1,
      );
      assert.ok(card.findAllByType('details').every((d) => !d.props.open));
      assert.equal(writes.length, 0);
      await act(async () => {
        findButton(tree, 'Continue this check').props.onClick();
      });
      assert.equal(writes.length, 1);
      assert.equal(
        writes[0].follow_up_id,
        value.exploration.next_check.question_id,
      );
      assert.equal(writes[0].question, value.exploration.next_check.question);
      assert.ok(
        !('answer_link' in writes[0]) && !('limitation_index' in writes[0]),
      );
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

for (const mode of [
  'missing',
  'wrong_question',
  'wrong_text',
  'index',
  'contract',
  'answered',
  'no_assessment',
  'changed',
])
  test(`unverified answer link does not acquire reader authority: ${mode}`, async () => {
    const value = answerLinkedEpisode();
    const link = value.exploration.next_check.answer_link;
    if (mode === 'missing') delete value.exploration.next_check.answer_link;
    if (mode === 'wrong_question') link.question = 'Another question';
    if (mode === 'wrong_text') link.limitation = 'UNVERIFIED LINK CANARY';
    if (mode === 'index') link.limitation_index = 4;
    if (mode === 'contract') link.contract = 'unknown/v1';
    if (mode === 'answered')
      value.exploration.briefing.assessment.status = 'possible_answer';
    if (mode === 'no_assessment') delete value.exploration.briefing.assessment;
    if (mode === 'changed') value.exploration.status = 'evidence_changed';
    serve(value, () => {
      throw new Error('Reading cannot start work');
    });
    let tree;
    try {
      await act(async () => {
        tree = create(React.createElement(Exploration, props));
      });
      assert.doesNotMatch(
        text(tree),
        /AI · connection to your answer|UNVERIFIED LINK CANARY|To investigate:/,
      );
      if (mode !== 'changed')
        assert.ok(findButton(tree, 'Continue this check'));
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

test('answer-linked check is read-only without edit authority', async () => {
  const value = answerLinkedEpisode();
  serve(value, () => {
    throw new Error('No work without edit authority');
  });
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.match(text(tree), /Independent recipient records/);
    assert.equal(findButton(tree, 'Continue this check'), undefined);
    assert.equal(tree.root.findAllByType('form').length, 0);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

for (const mode of [
  'complete',
  'empty',
  'partial',
  'indexes_unavailable',
  'unknown_indexes',
  'failed',
  'interrupted',
  'unconfirmed',
  'no_dispatch',
  'legacy',
  'changed',
  'unknown_contract',
  'limited',
]) {
  test(`recorded query journal keeps actual outcomes inside closed research details: ${mode}`, async () => {
    const value = episode();
    const journal = {
      contract: 'observed-public-queries/v1',
      status: 'ready',
      scope: {
        investigation_id: value.id,
        limit: 24,
        search_steps: 1,
        unrecorded_steps: 0,
        truncated: false,
      },
      items: [
        {
          step_id: 'observed-step',
          question: 'An unfinished public question',
          query: 'Exact recorded registry query',
          started_at: '2026-09-30T10:00:00Z',
          finished_at: '2026-09-30T10:00:01Z',
          outcome: 'completed',
          retrieval: {
            status: 'complete',
            indexes_completed: 1,
            indexes_unavailable: 0,
            indexes_unknown: false,
            candidate_appearances: 2,
          },
        },
      ],
    };
    const item = journal.items[0];
    if (mode === 'empty') item.retrieval.candidate_appearances = 0;
    if (mode === 'partial') item.retrieval.status = 'partial';
    if (mode === 'indexes_unavailable') item.retrieval.status = 'unavailable';
    if (mode === 'unknown_indexes') item.retrieval.status = 'unknown';
    if (['failed', 'interrupted', 'unconfirmed'].includes(mode)) {
      item.outcome = mode === 'failed' ? 'unavailable' : mode;
      item.retrieval = null;
    }
    if (mode === 'no_dispatch') {
      journal.items = [];
      journal.scope.search_steps = 0;
    }
    if (mode === 'legacy') journal.status = 'unknown';
    if (mode === 'changed') journal.status = 'evidence_changed';
    if (mode === 'unknown_contract') journal.contract = 'unknown-version';
    if (mode === 'limited')
      Object.assign(journal.scope, {
        limit: 1,
        search_steps: 4,
        unrecorded_steps: 1,
        truncated: true,
      });
    value.exploration.research_scope = {
      contract: 'observed-research-scope/v1',
      status: 'ready',
      activity: 'completed',
      searches: { completed: 1, unavailable: 0, interrupted: 0, running: 0 },
      indexes: { completed: 1, unavailable: 0, unknown_searches: 0 },
      reads: { completed: 1, unavailable: 0, interrupted: 0, running: 0 },
      material: {
        sources: 1,
        passages: 1,
        truncated_sources: 0,
        unknown_reader_scope: 0,
      },
      candidates: {
        retrieved: 2,
        not_evaluated: 1,
        evaluation_unavailable: 0,
        selected_not_read: 0,
      },
      questions: { open: 1, not_started: 0 },
      budget_stops: [],
      observed_queries: journal,
    };
    let tree,
      writes = 0;
    serve(value, () => {
      writes++;
      throw new Error('Reading a journal must not create work');
    });
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, {
            ...props,
            canEdit: false,
            historical: true,
          }),
        );
      });
      const content = text(tree);
      assert.equal(
        content.includes('Exact recorded registry query'),
        !['no_dispatch', 'legacy', 'changed', 'unknown_contract'].includes(
          mode,
        ),
      );
      const expected = {
        complete: 'Search returned candidates.',
        empty: 'Search returned no candidates.',
        partial: 'Some search indexes did not respond.',
        indexes_unavailable: 'Search indexes were unavailable.',
        unknown_indexes: 'Index outcomes were not recorded.',
        failed: 'No usable search result was recorded.',
        interrupted: 'Interrupted; execution outcome is unconfirmed.',
        unconfirmed: 'Dispatch recorded; execution outcome is unconfirmed.',
        no_dispatch: 'No search dispatch has been recorded in this episode.',
        legacy:
          'Exact search wording was not recorded for this earlier episode.',
        changed:
          'The search journal is unavailable because its supporting context changed.',
        limited: 'Showing the latest ',
      }[mode];
      if (expected) assert.ok(content.includes(expected), content);
      if (mode === 'limited')
        assert.ok(content.includes('Exact wording is unavailable for '));
      if (!['legacy', 'changed', 'unknown_contract'].includes(mode)) {
        const block = tree.root.findByProps({
          'aria-label': 'Recorded search attempts',
        });
        let details = block.parent;
        while (details && details.type !== 'details') details = details.parent;
        assert.ok(details && !details.props.open);
        assert.ok(
          content.includes(
            'Planned questions and proposed alternatives are not completed searches.',
          ),
        );
      }
      assert.equal(writes, 0);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });
}

test('late saved-check reads cannot revive a removed or denied answer link', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const value = answerLinkedEpisode();
  serve(value, () => {
    throw new Error('Polling must not write');
  });
  const initialFetch = globalThis.fetch;
  let defer = false;
  const pending = [];
  globalThis.fetch = (url, init) =>
    defer && url === `${base}/r`
      ? new Promise((resolve) => pending.push(resolve))
      : initialFetch(url, init);
  let tree;
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    assert.match(text(tree), /AI · connection to your answer/);
    defer = true;
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => t.mock.timers.tick(10000));
    const changed = structuredClone(value);
    changed.revision++;
    changed.exploration.next_check = null;
    await act(async () => pending[1](Response.json(changed)));
    await act(async () => pending[0](Response.json(value)));
    assert.doesNotMatch(text(tree), /AI · connection to your answer/);
    assert.equal(findButton(tree, 'Continue this check'), undefined);
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => t.mock.timers.tick(10000));
    await act(async () => pending[3](Response.json({}, { status: 403 })));
    await act(async () => pending[2](Response.json(value)));
    assert.doesNotMatch(
      text(tree),
      /AI · connection to your answer|Independent recipient records/,
    );
    assert.equal(findButton(tree, 'Continue this check'), undefined);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('living dossier retains multiple current research answers while the next direction runs', async () => {
  const value = savedUpdateEpisode();
  const earlier = structuredClone(
    value.exploration.question_assessments.assessments[0],
  );
  earlier.question_id = 'q-earlier';
  earlier.question = 'What does the first public record establish?';
  earlier.status = 'partial';
  earlier.points = [
    {
      statement:
        'The first record establishes a limited part of the original question.',
      evidence: [
        {
          source_id: 's',
          quote: 'The source passage is here.',
          locator: 'p1',
          role: 'support',
        },
      ],
    },
  ];
  value.exploration.question_assessments.assessments.unshift(earlier);
  serve(value, () => {
    throw new Error('Reading must not start research');
  });
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    const reading = tree.root.findByProps({ 'aria-label': 'Findings so far' });
    assert.equal(
      reading.findAllByType('h3')[0].props.children,
      'What else we have learned',
    );
    assert.equal(
      reading
        .findAllByType('h4')
        .filter((x) => x.props.children === earlier.question).length,
      1,
    );
    assert.equal(
      tree.root
        .findAllByType('h3')
        .filter(
          (x) =>
            x.props.children === 'Which part of this question is supported?',
        ).length,
      1,
    );
    assert.ok(!reading.findAllByType('article')[0].parent.props.open);
    assert.match(text(tree), /The first record establishes a limited part/);
    assert.match(text(tree), /Counterevidence/);
    assert.equal(tree.root.findAllByType('form').length, 0);
    assert.equal(
      tree.root
        .findAllByType('summary')
        .filter((x) => x.props.children === 'Research checkpoints by question')
        .length,
      0,
    );
    const invalid = structuredClone(value);
    invalid.exploration.question_assessments = {
      contract: 'branch-question-assessment/v1',
      status: 'evidence_changed',
    };
    serve(invalid, () => {
      throw new Error('No writes');
    });
    await act(async () => {
      tree.unmount();
    });
    await act(async () => {
      tree = create(
        React.createElement(Exploration, { ...props, canEdit: false }),
      );
    });
    assert.equal(
      tree.root.findAllByProps({ 'aria-label': 'Findings so far' }).length,
      0,
    );
    assert.doesNotMatch(
      text(tree),
      /The first record establishes a limited part/,
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('ordinary question leads with its answer, evidence and one useful next action', async () => {
  const value = answerLinkedEpisode('partial');
  const answer = value.exploration.briefing.assessment;
  answer.contract = 'research-question-assessment/v1';
  delete answer.selection;
  delete answer.selected_from_investigation_id;
  answer.points = [
    {
      statement: 'The recipient account needs reconciliation.',
      evidence: [
        {
          source_id: 's',
          quote: 'The source passage is here.',
          locator: 'p1',
          role: 'support',
        },
      ],
    },
  ];
  const writes = [];
  serve(value, async (url, init) => {
    writes.push(JSON.parse(init.body));
    return Response.json({ id: 'next' });
  });
  let tree;
  try {
    await act(async () => {
      tree = create(React.createElement(Exploration, props));
    });
    const section = tree.root.findByProps({
      'aria-label': 'Assessment of your question',
    });
    assert.match(
      JSON.stringify(
        section.toJSON?.() ||
          section.findAllByType('p').map((n) => n.props.children),
      ),
      /recipient account needs reconciliation/,
    );
    assert.equal(
      section.findByType('blockquote').props.children,
      'The source passage is here.',
    );
    assert.equal(
      section.findByType('a').props.href,
      'https://example.org/record',
    );
    assert.equal(
      tree.root
        .findAllByType('p')
        .filter((n) => n.children.join('') === value.question).length,
      1,
    );
    const background = tree.root
      .findAllByType('details')
      .find((n) =>
        n
          .findAllByType('summary')
          .some(
            (s) =>
              s.props.children === 'Research context & earlier understanding',
          ),
      );
    assert.ok(background && !background.props.open);
    assert.match(text(tree), /AI · connection to your answer/);
    assert.equal(writes.length, 0);
    await act(async () =>
      findButton(tree, 'Continue this check').props.onClick(),
    );
    assert.equal(writes.length, 1);
    assert.equal(
      writes[0].follow_up_id,
      value.exploration.next_check.question_id,
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

for (const phase of ['queued', 'failed', 'completed'])
  test(`earlier findings stay readable through continuation: ${phase}`, async () => {
    const earlier = episode();
    earlier.question = 'The earlier funding question.';
    earlier.exploration.briefing.understanding =
      'Earlier foundation interpretation.';
    const current = episode();
    current.question = 'Investigate the recipient side now.';
    current.status = phase;
    if (phase !== 'completed') {
      current.exploration.status =
        phase === 'queued' ? 'exploring' : 'unavailable';
      current.exploration.briefing = null;
      current.exploration.sources = [];
    }
    current.exploration.retained_research = {
      investigation_id: 'prior',
      question: earlier.question,
      updated_at: '2026-10-01T01:00:00Z',
      exploration: earlier.exploration,
    };
    let writes = 0;
    serve(current, () => {
      writes++;
      throw new Error('Reading must not start work');
    });
    let tree;
    try {
      await act(async () => {
        tree = create(
          React.createElement(Exploration, { ...props, canEdit: false }),
        );
      });
      const saved = tree.root
        .findAllByType('details')
        .find((n) =>
          n
            .findAllByType('summary')
            .some(
              (s) => s.props.children === 'Findings kept from earlier research',
            ),
        );
      assert.ok(saved);
      assert.equal(!!saved.props.open, phase !== 'completed');
      assert.match(
        JSON.stringify(saved.findAllByType('p').map((p) => p.props.children)),
        /Earlier foundation interpretation/,
      );
      assert.match(text(tree), /The earlier funding question/);
      assert.ok(
        saved
          .findAllByType('a')
          .some((a) => a.props.href === 'https://example.org/record'),
      );
      assert.ok(
        saved
          .findAllByType('blockquote')
          .some((q) => q.props.children === 'The source passage is here.'),
      );
      if (phase === 'queued')
        assert.match(text(tree), /Continuing your research/);
      if (phase === 'failed') assert.match(text(tree), /Your saved research/);
      assert.equal(writes, 0);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  });

test('mission reader separates the answer, counterevidence and named gaps without setup fields', async () => {
  const { MissionReading } = require(resolve('components/research-mission.tsx'));
  const ref = { source_id: 'source-one', quote: 'The two reported amounts differ.', locator: 'page-25-text-1-char-1' };
  const state = { status: 'ready', sources: [{ id: 'source-one', title: 'Fictional original', url: 'https://example.org/original' }],
    mission: { contract: 'research-mission/v1', stage: 'finished', round: 2, stop: 'available_checks_complete', question: 'Who received the grant?',
      answer: { status: 'conflicting', points: [{ statement: 'The reported amounts conflict.', evidence: [{ ...ref, role: 'counterevidence' }] }], limitations: ['The reason for the discrepancy is unknown.'] },
      checkpoints: [{ round: 1, reason: 'Read the revised original.', gaps: [], action: 'continue' }, { round: 2, reason: 'The original still does not resolve the conflict.', gaps: [], action: 'finish' }],
      documents: [{ url: 'https://example.org/original', portions: 7, page_count: 25, complete: true, warnings: [] }] } };
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(MissionReading, { state })); });
    assert.match(text(tree), /What the evidence says/);
    assert.match(text(tree), /Where the evidence conflicts/);
    assert.match(text(tree), /The reason for the discrepancy is unknown/);
    assert.match(text(tree), /page-25-text-1-char-1/);
    assert.equal(tree.root.findAllByType('input').length, 0);
    assert.equal(tree.root.findAllByType('select').length, 0);
    assert.equal(tree.root.findAllByType('blockquote')[0].props.children, ref.quote);
    await act(async () => tree.update(React.createElement(MissionReading, { state: { ...state, mission: { ...state.mission, stage: 'evidence_changed', answer: null } } })));
    assert.equal(tree.toJSON(), null);
  } finally { if (tree) await act(async () => tree.unmount()); }
});
