import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';

// May run outside the checkout: run node --test /tmp/hl-research-entry.test.mjs
// from either client root. No source copies or additional node_modules needed.
const require = createRequire(resolve('package.json'));
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
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
globalThis.document = { cookie: '' };
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
const Empty = () => null;
const wrap = ({ children }) => React.createElement('div', null, children);
function DossierSetup({ onSetup }) {
  return React.createElement(
    'button',
    { onClick: onSetup },
    'Edit saved setup',
  );
}
Module._load = function (name, parent, ...args) {
  if (name === 'lucide-react') return new Proxy({}, { get: () => Empty });
  if (name === 'next/link') return { __esModule: true, default: wrap };
  if (name.includes('/ui/'))
    return new Proxy(
      {},
      {
        get: (_target, key) =>
          ({
            Button: 'button',
            Input: 'input',
            Textarea: 'textarea',
            Checkbox: 'input',
            NativeSelect: 'select',
            NativeSelectOption: 'option',
          })[key] || wrap,
      },
    );
  // Keep the entire entry chain real: Workspace, ResearchDesk, Discovery,
  // DecisionDiscovery, Wizard, ResearchStart, API and access-aware readers.
  // Replace independent panels and the separately tested suggestion job UI.
  if (
    parent?.filename === resolve('components/workspace.tsx') &&
    name.startsWith('./')
  ) {
    if (['./research-desk', './wizard', './field'].includes(name))
      return originalLoad.call(this, name, parent, ...args);
    if (name === './dossier') return { Dossier: DossierSetup };
    if (name === './app-shell')
      return { AppShell: wrap, GlassSidebar: wrap, TopNavigation: wrap };
    return new Proxy({}, { get: () => Empty });
  }
  if (
    [
      './universal-ask-search',
      './dossier-limit-request',
      './query-bundle',
      './dossier-template',
      './domain-context',
      './public-origin',
      './topic-suggestions',
    ].includes(name)
  )
    return new Proxy({}, { get: () => Empty });
  return originalLoad.call(this, name, parent, ...args);
};
after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolve;
  for (const [ext, value] of extensions) {
    if (value) Module._extensions[ext] = value;
    else delete Module._extensions[ext];
  }
  for (const [key, value] of globals) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});
const { default: Workspace, emptyConfig } = require(
  resolve('components/workspace.tsx'),
);
const { ResearchDesk } = require(resolve('components/research-desk.tsx'));
const { ResearchStart } = require(resolve('components/research-start.tsx'));
const { Wizard } = require(resolve('components/wizard.tsx'));
const { product } = require(resolve('lib/product.ts'));
const root = `/api/products/${product.id}`;
const query =
  'Status S and military obligation for Ukrainian citizens aged 18–55?';
const hit = {
  id: 'public-source',
  kind: 'source',
  provider: 'fedlex',
  title: 'A source title must not become the user’s question',
  summary: 'A search snippet, not a captured or validated source.',
  url: 'https://example.org/source',
  date: null,
};
const response = (value, status = 200) => Response.json(value, { status });
const content = (node) =>
  typeof node === 'string' || typeof node === 'number'
    ? String(node)
    : Array.isArray(node)
      ? node.map(content).join('')
      : node?.children
        ? node.children.map(content).join('')
        : '';
const shown = (tree) => JSON.stringify(tree.toJSON());
function button(tree, label) {
  const found = tree.root
    .findAllByType('button')
    .filter((node) => content(node).trim() === label);
  assert.equal(found.length, 1, `Expected one button: ${label}`);
  return found[0];
}
async function click(tree, label) {
  const target = button(tree, label);
  assert.ok(!target.props.disabled, `Button should be enabled: ${label}`);
  await act(async () => target.props.onClick());
}
async function type(node, value) {
  await act(async () => node.props.onChange({ target: { value } }));
}
async function submit(form) {
  await act(async () => form.props.onSubmit({ preventDefault() {} }));
}
function questionInput(tree) {
  return tree.root.findByType(ResearchStart).findByType('textarea');
}
function manualGoal(tree) {
  return tree.root
    .findByType(Wizard)
    .findAllByType('textarea')
    .find((node) => node.props.maxLength === 3000);
}
function savedDraft(config = emptyConfig(), step = 1) {
  return {
    id: 'saved-draft',
    access: { can_edit: true },
    profile: {
      id: 'profile-existing',
      revision: 7,
      status: 'draft',
      step,
      config: { ...config },
      created_at: '2026-10-05T10:00:00Z',
    },
  };
}
async function mounted({ search = '', explore } = {}) {
  const requests = [],
    unexpected = [],
    navigations = [];
  const location = { search, assign: (url) => navigations.push(url) };
  const window = new EventTarget();
  window.location = location;
  window.history = {
    pushState(_state, _title, url) {
      location.search = new URL(url, 'https://example.test').search;
    },
    replaceState(_state, _title, url) {
      location.search = new URL(url, 'https://example.test').search;
    },
  };
  globalThis.window = window;
  globalThis.fetch = async (url, init) => {
    const path = new URL(url, 'https://example.test');
    const body = init.body ? JSON.parse(init.body) : undefined;
    const record = { url, method: init.method, body };
    requests.push(record);
    if (init.method === 'GET') {
      if (url === '/api/auth/session')
        return response({
          authenticated: true,
          role: 'organization_admin',
          user: { id: 'owner', name: 'Owner' },
          organization: { id: 'workspace', name: 'Workspace' },
        });
      if (url === `${root}/dossiers`) return response({ items: [], total: 0 });
      if (url === '/api/source-packs') return response({ items: [] });
      if (url === '/api/monitoring-profiles')
        return response({ email_available: false });
      if (url === `${root}/research-allowance`)
        return response({
          remaining: 3,
          limit: 3,
          used: 0,
          latest_request: null,
        });
      if (url === `${root}/discover/engines`)
        return response({
          search_configured: true,
          jev_configured: true,
          laya_configured: true,
        });
      if (path.pathname === `${root}/discover/runs`)
        return response({ items: [] });
      if (path.pathname === `${root}/discover`)
        return response({
          query: path.searchParams.get('q'),
          provider: path.searchParams.get('provider'),
          items: [hit],
          checked_at: '2026-10-05T10:00:00Z',
          coverage: 'Fixture catalogue search.',
        });
      if (url === `${root}/dossiers/saved-draft`) return response(savedDraft());
    }
    if (init.method === 'POST') {
      if (url === `${root}/discover/decision`)
        return response({
          id: 'decision-result',
          query: body.query,
          mode: body.mode,
          status: 'complete',
          checked_at: '2026-10-05T10:00:00Z',
          items: [hit],
          labels: {},
          engines: [],
        });
      if (url === `${root}/explore`)
        return explore
          ? explore(record)
          : response(
              { dossier_id: 'researched', investigation: { id: 'run' } },
              202,
            );
      if (url === `${root}/dossiers`)
        return response(savedDraft(body.config, body.step), 201);
    }
    unexpected.push(record);
    throw Error(
      `Unexpected fixture request: ${init.method} ${typeof url === 'string' ? url : 'non-string URL'}`,
    );
  };
  let tree;
  await act(async () => {
    tree = create(React.createElement(Workspace));
  });
  return {
    tree,
    requests,
    navigations,
    writes: () => requests.filter((value) => value.method !== 'GET'),
    async close() {
      await act(async () => tree.unmount());
      assert.deepEqual(
        unexpected,
        [],
        'No unmodelled network route is silently ignored',
      );
    },
  };
}
async function searchAndChoose(h, lane, target = 'Research this topic') {
  if (lane === 'catalogue') {
    await click(h.tree, 'Team & source catalogues');
    await type(
      h.tree.root.findByProps({ 'aria-label': 'Where to search' }),
      'fedlex',
    );
    await type(
      h.tree.root.findByProps({ 'aria-label': 'Search phrase' }),
      query,
    );
    await submit(h.tree.root.findByProps({ className: 'discovery-form' }));
  } else {
    await type(
      h.tree.root.findByProps({ 'aria-label': 'Public web query' }),
      query,
    );
    const form = h.tree.root.findByProps({ className: 'decision-form' });
    await act(async () =>
      form
        .findByProps({ type: 'checkbox' })
        .props.onChange({ target: { checked: true } }),
    );
    await submit(form);
  }
  await click(h.tree, target);
}

for (const lane of ['web', 'catalogue'])
  test(`${lane} result enters real question-first creation and submits the exact query`, async () => {
    const h = await mounted();
    try {
      await searchAndChoose(h, lane);
      assert.equal(h.tree.root.findByType(Wizard).props.initial, null);
      assert.equal(questionInput(h.tree).props.value, query);
      assert.equal(
        h.tree.root.findAllByProps({
          'aria-label': 'Monitoring setup progress',
        }).length,
        0,
      );
      assert.doesNotMatch(
        shown(h.tree),
        /Monitor developments related to:|Topics & AI/,
      );
      const before = h.writes().length;
      await submit(h.tree.root.findByType(ResearchStart).findByType('form'));
      assert.equal(h.writes().length, before + 1);
      const request = h.writes().at(-1);
      assert.equal(request.url, `${root}/explore`);
      assert.deepEqual(Object.keys(request.body).sort(), [
        'public_query_confirmed',
        'question',
        'request_key',
      ]);
      assert.equal(request.body.question, query);
      assert.equal(request.body.public_query_confirmed, true);
      assert.ok(request.body.request_key);
      assert.deepEqual(h.navigations, ['/?dossier=researched']);
      assert.equal(
        h
          .writes()
          .some(
            (value) =>
              value.url.includes('/monitoring-profiles/') ||
              value.url === `${root}/dossiers`,
          ),
        false,
      );
    } finally {
      await h.close();
    }
  });

test('catalogue whole-query action carries the question without inventing a selected source', async () => {
  const h = await mounted();
  try {
    await searchAndChoose(h, 'catalogue', 'Start research');
    assert.equal(questionInput(h.tree).props.value, query);
    assert.equal(
      h.tree.root.findByType(Wizard).props.seed.source_requests,
      undefined,
    );
    assert.equal(
      h.writes().length,
      0,
      'Opening the research form does not start work',
    );
  } finally {
    await h.close();
  }
});

test('manual setup from the research desk keeps the currently typed question', async () => {
  const h = await mounted();
  const typed = 'My edited question before explicitly choosing manual setup';
  try {
    await type(questionInput(h.tree), typed);
    await click(h.tree, 'Set up topics and sources manually');
    assert.equal(
      h.tree.root.findByType(Wizard).props.creationMode,
      'monitoring',
    );
    assert.equal(h.tree.root.findAllByType(ResearchStart).length, 0);
    assert.equal(manualGoal(h.tree).props.value, typed);
    assert.equal(
      h.tree.root.findAllByProps({ 'aria-label': 'Monitoring setup progress' })
        .length,
      1,
    );
    assert.equal(h.writes().length, 0);
  } finally {
    await h.close();
  }
});

test('switching seeded research to manual setup preserves edits and the separate selected source', async () => {
  const h = await mounted();
  const edited = 'Keep this revision of the original research question';
  try {
    await searchAndChoose(h, 'web');
    await type(questionInput(h.tree), edited);
    await act(async () => h.tree.update(React.createElement(Workspace)));
    assert.equal(
      questionInput(h.tree).props.value,
      edited,
      'Ordinary rerender preserves local edits',
    );
    await click(h.tree, 'Set up topics and sources manually');
    assert.equal(manualGoal(h.tree).props.value, edited);
    assert.equal(
      h.writes().length,
      1,
      'Only the earlier fake web search has been submitted',
    );
    await click(h.tree, 'Save draft');
    const write = h.writes().at(-1);
    assert.equal(write.url, `${root}/dossiers`);
    assert.equal(write.body.config.goal, edited);
    assert.equal(write.body.config.name, query.slice(0, 120));
    assert.equal(
      write.body.config.sector,
      product.id === 'pharma' ? 'Pharmaceuticals' : 'Legal services',
    );
    assert.equal(write.body.config.source_requests.length, 1);
    assert.deepEqual(
      { ...write.body.config.source_requests[0], id: '<new-id>' },
      {
        id: '<new-id>',
        label: hit.title,
        url: hit.url,
        kind: 'signals',
        status: 'requested',
      },
    );
    assert.equal(
      h.writes().some((value) => value.url === `${root}/explore`),
      false,
    );
  } finally {
    await h.close();
  }
});

test('existing saved profile setup remains manual even when research is the default creation mode', async () => {
  const h = await mounted({ search: '?dossier=saved-draft' });
  try {
    await click(h.tree, 'Edit saved setup');
    const wizard = h.tree.root.findByType(Wizard);
    assert.equal(wizard.props.creationMode, 'research');
    assert.equal(wizard.props.initial.id, 'saved-draft');
    assert.equal(h.tree.root.findAllByType(ResearchStart).length, 0);
    assert.match(shown(h.tree), /Give your question focus/);
    assert.equal(
      h.tree.root.findAllByProps({ 'aria-label': 'Monitoring setup progress' })
        .length,
      1,
    );
    assert.equal(
      h.writes().length,
      0,
      'Opening an existing draft must not create another dossier',
    );
  } finally {
    await h.close();
  }
});

test('uncertain research admission keeps its exact request and blocks switching to another creation path', async () => {
  let count = 0;
  const h = await mounted({
    explore: () =>
      ++count === 1
        ? response({ detail: 'Unavailable' }, 503)
        : response(
            { dossier_id: 'recovered', investigation: { id: 'one-run' } },
            202,
          ),
  });
  try {
    await type(questionInput(h.tree), query);
    await submit(h.tree.root.findByType(ResearchStart).findByType('form'));
    assert.equal(
      button(h.tree, 'Set up topics and sources manually').props.disabled,
      true,
    );
    assert.equal(questionInput(h.tree).props.disabled, true);
    assert.equal(h.tree.root.findAllByType(Wizard).length, 0);
    assert.equal(h.writes().length, 1);
    await submit(h.tree.root.findByType(ResearchStart).findByType('form'));
    assert.equal(h.writes().length, 2);
    assert.deepEqual(
      h.writes()[1],
      h.writes()[0],
      'Retry preserves question, consent and idempotency key',
    );
    assert.deepEqual(h.navigations, ['/?dossier=recovered']);
  } finally {
    await h.close();
  }
});

test('an overlong programmatic seed stays editable and is not silently truncated or submitted', async () => {
  const h = await mounted();
  const long = 'A'.repeat(301);
  try {
    await act(async () =>
      h.tree.root
        .findByType(ResearchDesk)
        .props.onStart({ name: 'Long question', goal: long, sector: '' }),
    );
    assert.equal(questionInput(h.tree).props.value, long);
    await submit(h.tree.root.findByType(ResearchStart).findByType('form'));
    assert.equal(h.writes().length, 0);
    assert.equal(questionInput(h.tree).props.disabled, false);
    assert.equal(
      button(h.tree, 'Set up topics and sources manually').props.disabled,
      false,
    );
    assert.match(shown(h.tree), /within 300 characters/);
    await type(questionInput(h.tree), query);
    await submit(h.tree.root.findByType(ResearchStart).findByType('form'));
    assert.equal(h.writes()[0].body.question, query);
  } finally {
    await h.close();
  }
});
