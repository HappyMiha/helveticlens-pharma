import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename,
  originalLoad = Module._load;
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
globalThis.window = new EventTarget();
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(
    this,
    name.startsWith('@/') ? resolve(name.slice(2)) : name,
    ...args,
  );
};
for (const ext of extensions.keys())
  Module._extensions[ext] = (module, filename) =>
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
const Empty = () => null,
  wrap = ({ children }) => React.createElement('div', null, children);
Module._load = function (name, parent, ...args) {
  if (name === 'lucide-react') return new Proxy({}, { get: () => Empty });
  if (name.includes('/ui/'))
    return new Proxy(
      {},
      {
        get: (_target, key) =>
          ({
            Button: 'button',
            Input: 'input',
            Textarea: 'textarea',
            NativeSelect: 'select',
            NativeSelectOption: 'option',
            Checkbox: 'input',
          })[key] || wrap,
      },
    );
  return originalLoad.call(this, name, parent, ...args);
};
after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolve;
  for (const [ext, value] of extensions) {
    if (value) Module._extensions[ext] = value;
    else delete Module._extensions[ext];
  }
  for (const [key, value] of globals) globalThis[key] = value;
});
const { FeedForm, FeedsWorkspace, DossierFeeds } = require(
  resolve('components/feeds.tsx'),
);
const {
  FeedPrecision,
  FeedRelevance,
  FeedDossierContext,
  FeedWatchProposal,
} = require(resolve('components/feed-intelligence.tsx'));
const { feedSources } = require(resolve('lib/feeds.ts'));
const { product } = require(resolve('lib/product.ts'));
const f1 = '11111111-1111-4111-8111-111111111111',
  f2 = '22222222-2222-4222-8222-222222222222';
const feed = (id = f1) => ({
  id,
  revision: 3,
  product: product.id,
  name: 'Watch public regulatory changes',
  query: 'Which regulatory changes matter?',
  sources: [],
  status: 'active',
  checked_at: null,
  next_check_at: null,
  error: null,
  job: null,
  update_count: 2,
  can_manage: true,
  intelligence: {
    mode: 'semantic',
    include: [],
    exclude: [],
    languages: ['en', 'de'],
    plan_status: 'pending',
    understanding: '',
    concepts: [],
    synonyms: [],
    queries: [],
    feedback_count: 0,
    context_count: 0,
    scope: 'Public source meaning',
  },
  follow: {
    following: true,
    revision: 1,
    latest_sequence: 2,
    seen_sequence: 0,
    unread_count: 2,
  },
  unread_count: 2,
});
const catalog = [
  {
    id: 'official-news',
    label: 'Official source news',
    products: ['legal', 'pharma'],
  },
];
const library = (items = [feed()]) => ({
  items,
  total: items.length,
  can_create: true,
  sources: catalog,
  offset: 0,
  page_size: 30,
});
const update = (id, sequence) => ({
  id,
  sequence,
  title: `Saved source ${sequence}`,
  url: `https://example.org/${id}`,
  summary: `Publisher preview ${sequence}`,
  content_hash: 'a'.repeat(64),
  published_at: null,
  created_at: '2026-10-14T10:00:00Z',
  reading_complete: false,
});
const proposal = (overrides = {}) => ({
  name: 'My dossier',
  query: 'Track registry updates',
  question: 'Track registry updates',
  basis: 'public_research',
  proposal_fingerprint: 'reviewed-public-context',
  findings: [
    {
      statement: 'An official change was published.',
      source_id: 'public-source',
      url: 'https://example.org/source',
      quote: 'The official wording.',
      locator: 'Article 2',
    },
  ],
  gaps: ['When will implementation begin?'],
  scope: 'Only public research findings and questions are used.',
  ...overrides,
});
const response = (data, status = 200) => Response.json(data, { status });
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
const shown = (tree) => JSON.stringify(tree.toJSON());
const content = (node) =>
  typeof node === 'string'
    ? node
    : Array.isArray(node)
      ? node.map(content).join('')
      : node
        ? content(node.children)
        : '';
const button = (tree, label) =>
  tree.root.findAllByType('button').find((node) => content(node) === label);
const submit = (tree) =>
  tree.root
    .findAllByType('form')
    .at(-1)
    .props.onSubmit({ preventDefault() {} });
async function mount(Component, props, fetch) {
  globalThis.window = new EventTarget();
  globalThis.fetch = fetch;
  let tree;
  await act(async () => {
    tree = create(React.createElement(Component, props));
  });
  return {
    tree,
    update: async (next) => {
      props = { ...props, ...next };
      await act(async () => tree.update(React.createElement(Component, props)));
    },
    close: async () => {
      await act(async () => tree.unmount());
    },
  };
}

test('feed sources accept catalogue selections and public HTTPS URLs but reject unsafe schemes and credentials', () => {
  assert.deepEqual(
    feedSources(
      ['official-news'],
      ' https://example.org/feed\nhttps://example.org/feed ',
    ),
    ['official-news', 'https://example.org/feed'],
  );
  for (const url of [
    'http://example.org',
    'javascript:alert(1)',
    'https://user:password@example.org',
    'not a URL',
  ])
    assert.throws(() => feedSources([], url), /HTTPS/);
});

test('question-first feed creation does not write on mount or blank input and preserves exact uncertain retry', async () => {
  const writes = [],
    saved = [];
  let calls = 0;
  const h = await mount(
    FeedForm,
    { catalog, onSaved: (value) => saved.push(value) },
    async (url, init) => {
      writes.push({ url, body: JSON.parse(init.body) });
      if (++calls === 1) throw Error('Lost response');
      return response(feed());
    },
  );
  try {
    assert.equal(writes.length, 0);
    assert.ok(button(h.tree, 'Watch'));
    await act(async () => submit(h.tree));
    assert.equal(writes.length, 0);
    await act(async () =>
      h.tree.root.findAllByType('textarea')[0].props.onChange({
        target: { value: 'Follow changes in the source registry.' },
      }),
    );
    await act(async () => submit(h.tree));
    assert.equal(writes.length, 1);
    assert.equal(h.tree.root.findAllByType('textarea')[0].props.disabled, true);
    assert.ok(button(h.tree, 'Retry the same save'));
    await act(async () => submit(h.tree));
    assert.deepEqual(writes[1], writes[0]);
    assert.equal(writes[0].url, '/api/feeds');
    assert.equal(writes[0].body.product, product.id);
    assert.deepEqual(writes[0].body.sources, []);
    assert.equal(saved.length, 1);
  } finally {
    await h.close();
  }
});

test('acknowledged feed save retries only the saved-view callback and definitive validation errors stay editable', async () => {
  let writes = 0,
    callbacks = 0;
  const h = await mount(
    FeedForm,
    {
      catalog,
      initialQuery: 'Watch official updates',
      onSaved: async () => {
        if (++callbacks === 1) throw Error('View failed');
      },
    },
    async () => {
      writes++;
      return response(feed());
    },
  );
  try {
    await act(async () => submit(h.tree));
    assert.equal(writes, 1);
    assert.match(shown(h.tree), /change was saved/);
    await act(async () => submit(h.tree));
    assert.equal(writes, 1);
    assert.equal(callbacks, 2);
  } finally {
    await h.close();
  }
  const invalid = await mount(
    FeedForm,
    { catalog, initialQuery: 'Watch official updates', onSaved: () => {} },
    async () => response({ detail: 'Choose an available source.' }, 422),
  );
  try {
    await act(async () => submit(invalid.tree));
    assert.match(shown(invalid.tree), /Choose an available source/);
    assert.equal(
      invalid.tree.root.findAllByType('textarea')[0].props.disabled,
      false,
    );
  } finally {
    await invalid.close();
  }
});

test('dossier creation links entire feed history through one command without submitting the visible page', async () => {
  const writes = [],
    created = [];
  const h = await mount(
    FeedsWorkspace,
    {
      selectedId: f1,
      onSelect: () => {},
      onCreated: (value) => created.push(value),
    },
    async (url, init) => {
      if (init.method === 'POST') {
        writes.push({ url, body: JSON.parse(init.body) });
        return response({
          dossier_id: 'new-dossier',
          product: product.id,
          link: { pending_count: 205 },
          investigation: { id: 'research', status: 'queued' },
        });
      }
      if (url === '/api/feeds') return response(library());
      if (url === `/api/feeds/${f1}`) return response(feed());
      if (url.includes('/updates?'))
        return response({
          items: [update('one', 1)],
          total: 205,
          next_sequence: 1,
        });
      throw Error('Unexpected read ' + url);
    },
  );
  try {
    assert.equal(writes.length, 0);
    assert.match(shown(h.tree), /All retained feed history/);
    const destination = h.tree.root
      .findAllByType('summary')
      .find((node) => content(node).startsWith('Dossier destination'));
    assert.notEqual(destination.parent.props.open, true);
    assert.ok(button(h.tree, 'Research deeper'));
    assert.match(content(h.tree.root), /1 of 205/);
    await act(async () => submit(h.tree));
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, `/api/feeds/${f1}/dossiers`);
    assert.equal(writes[0].body.expected_revision, 3);
    assert.equal(writes[0].body.question, feed().query);
    assert.equal('updates' in writes[0].body, false);
    assert.equal('limit' in writes[0].body, false);
    assert.equal(created[0].link.pending_count, 205);
  } finally {
    await h.close();
  }
});

test('feed history uses cursor pagination and ignores an old feed response after navigation', async () => {
  const slow = deferred();
  const reads = [];
  const h = await mount(
    FeedsWorkspace,
    { selectedId: f1, onSelect: () => {}, onCreated: () => {} },
    async (url) => {
      reads.push(url);
      if (url === '/api/feeds') return response(library([feed(f1), feed(f2)]));
      if (url === `/api/feeds/${f1}` || url === `/api/feeds/${f2}`)
        return response(feed(url.endsWith(f2) ? f2 : f1));
      if (url.includes('before_sequence=2')) return slow.promise;
      if (url.includes(`/feeds/${f2}/updates`))
        return response({
          items: [update('new', 9)],
          total: 1,
          next_sequence: null,
        });
      return response({
        items: [update('first', 2)],
        total: 2,
        next_sequence: 2,
      });
    },
  );
  try {
    await act(async () => button(h.tree, 'Load older updates').props.onClick());
    assert.ok(reads.some((url) => url.includes('before_sequence=2')));
    await h.update({ selectedId: f2 });
    await act(async () =>
      slow.resolve(
        response({
          items: [update('old-late', 1)],
          total: 2,
          next_sequence: null,
        }),
      ),
    );
    assert.match(shown(h.tree), /Saved source 9/);
    assert.doesNotMatch(shown(h.tree), /Saved source 1/);
  } finally {
    await h.close();
  }
});

test('creating a feed inside a dossier uses the atomic create-and-link route and keeps monitoring independent', async () => {
  const writes = [];
  let changes = 0;
  const links = { items: [], can_manage: true };
  const h = await mount(
    DossierFeeds,
    {
      dossierId: 'd',
      name: 'My dossier',
      question: 'Track registry updates',
      canEdit: true,
      onChanged: async () => {
        changes++;
      },
      onResearch: () => {},
    },
    async (url, init) => {
      if (init.method === 'POST') {
        writes.push({ url, body: JSON.parse(init.body) });
        return response({ id: 'link', feed_id: f1 });
      }
      if (url === '/api/feeds') return response(library());
      if (url.endsWith('/proposal')) return response(proposal());
      return response(links);
    },
  );
  try {
    assert.equal(writes.length, 0);
    assert.match(shown(h.tree), /own monitoring is unchanged/);
    assert.match(content(h.tree.root), /Based on the public findings/);
    assert.match(content(h.tree.root), /When will implementation begin/);
    const adjustment = h.tree.root
      .findAllByType('summary')
      .find((node) => content(node) === 'Adjust what to watch');
    assert.ok(!adjustment.parent.props.open);
    assert.ok(button(h.tree, 'Watch changes'));
    await act(async () => submit(h.tree));
    assert.equal(writes.length, 1);
    assert.equal(
      writes[0].url,
      `/api/products/${product.id}/dossiers/d/feeds/create`,
    );
    assert.equal(writes[0].body.name, 'My dossier');
    assert.equal(writes[0].body.question, 'Track registry updates');
    assert.equal(
      writes[0].body.proposal_fingerprint,
      'reviewed-public-context',
    );
    assert.equal(changes, 1);
  } finally {
    await h.close();
  }
});

test('linking an existing feed records its revision and shows queued dossier processing separately', async () => {
  const writes = [],
    opened = [];
  let linked = false;
  const link = {
    id: 'link',
    revision: 1,
    feed_id: f1,
    dossier_id: 'd',
    status: 'active',
    cursor_sequence: 0,
    pending_count: 205,
    feed: feed(),
    investigation: { id: 'impact', status: 'queued' },
  };
  const h = await mount(
    DossierFeeds,
    {
      dossierId: 'd',
      name: 'Dossier',
      question: 'A question',
      canEdit: true,
      onChanged: async () => {},
      onResearch: (id) => opened.push(id),
    },
    async (url, init) => {
      if (init.method === 'POST') {
        writes.push(JSON.parse(init.body));
        linked = true;
        return response(link);
      }
      if (url === '/api/feeds') return response(library());
      if (url.endsWith('/proposal')) return response(proposal());
      return response({ items: linked ? [link] : [], can_manage: true });
    },
  );
  try {
    await act(async () => button(h.tree, 'Link existing feed').props.onClick());
    await act(async () =>
      h.tree.root
        .findByType('select')
        .props.onChange({ target: { value: f1 } }),
    );
    await act(async () => submit(h.tree));
    assert.equal(writes.length, 1);
    assert.equal(writes[0].expected_feed_revision, 3);
    assert.equal(writes[0].question, 'A question');
    assert.match(
      shown(h.tree),
      /205 saved updates awaiting dossier processing/,
    );
    assert.match(shown(h.tree), /Dossier impact research/);
    assert.equal(opened.length, 0);
    await act(async () =>
      button(h.tree, 'Open impact research').props.onClick(),
    );
    assert.deepEqual(opened, ['impact']);
  } finally {
    await h.close();
  }
});

test('read-only dossier members see link status without private feed-library reads or write controls', async () => {
  const reads = [];
  const h = await mount(
    DossierFeeds,
    {
      dossierId: 'd',
      name: 'Dossier',
      question: 'A question',
      canEdit: false,
      onChanged: async () => {},
      onResearch: () => {},
    },
    async (url, init) => {
      reads.push(url);
      assert.equal(init.method, 'GET');
      return response({ items: [], can_manage: false });
    },
  );
  try {
    assert.equal(button(h.tree, 'Link existing feed'), undefined);
    assert.equal(button(h.tree, 'Create a feed'), undefined);
    assert.deepEqual(reads, [`/api/products/${product.id}/dossiers/d/feeds`]);
  } finally {
    await h.close();
  }
});

test('session changes hide loaded feed history and discard pending callback authority', async () => {
  const slow = deferred();
  let denied = false,
    callbacks = 0;
  const h = await mount(
    FeedsWorkspace,
    {
      selectedId: f1,
      onSelect: () => {},
      onCreated: () => {
        callbacks++;
      },
    },
    async (url, init) => {
      if (init.method === 'POST') return slow.promise;
      if (denied) return response({ detail: 'Access revoked.' }, 403);
      if (url === '/api/feeds') return response(library());
      if (url === `/api/feeds/${f1}`) return response(feed());
      return response({
        items: [update('private', 1)],
        total: 1,
        next_sequence: null,
      });
    },
  );
  try {
    await act(async () => submit(h.tree));
    denied = true;
    await act(async () =>
      window.dispatchEvent(new Event('helvetic-session-changed')),
    );
    assert.match(shown(h.tree), /Access revoked/);
    assert.doesNotMatch(shown(h.tree), /Publisher preview/);
    await act(async () =>
      slow.resolve(
        response({ dossier_id: 'private-result', product: product.id }),
      ),
    );
    assert.equal(callbacks, 0);
  } finally {
    await h.close();
  }
});

test('in-app follow retries the exact desired state without request_key and reflects the saved state', async () => {
  const writes = [];
  let saved = feed(),
    attempts = 0;
  const h = await mount(
    FeedsWorkspace,
    { selectedId: f1, onSelect() {}, onCreated() {} },
    async (url, init) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body);
        writes.push({ url, body });
        saved = {
          ...saved,
          follow: { ...saved.follow, following: false, revision: 2 },
          unread_count: 0,
        };
        if (++attempts === 1) throw Error('Response lost');
        return response(saved.follow);
      }
      if (url === '/api/feeds') return response(library([saved]));
      if (url.endsWith('/updates?order=newest&view=main&limit=50'))
        return response({
          items: [update('one', 1)],
          total: 2,
          next_sequence: 1,
        });
      return response(saved);
    },
  );
  try {
    assert.match(content(h.tree.root), /2 unread source updates/);
    await act(async () => button(h.tree, 'In-app updates on').props.onClick());
    assert.deepEqual(writes[0], {
      url: `/api/feeds/${f1}/follow`,
      body: { expected_revision: 1, following: false },
    });
    await act(async () =>
      button(h.tree, 'Retry notification change').props.onClick(),
    );
    assert.deepEqual(writes[1], writes[0]);
    assert.equal(
      button(h.tree, 'In-app updates off').props['aria-pressed'],
      false,
    );
    assert.doesNotMatch(content(h.tree.root), /unread source updates/);
  } finally {
    await h.close();
  }
});

test('mark read acknowledges the newest displayed update and earlier history while later arrivals stay unread', async () => {
  const writes = [];
  let saved = {
    ...feed(),
    update_count: 205,
    follow: { ...feed().follow, latest_sequence: 205, unread_count: 205 },
    unread_count: 205,
  };
  const h = await mount(
    FeedsWorkspace,
    { selectedId: f1, onSelect() {}, onCreated() {} },
    async (url, init) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body);
        writes.push({ url, body });
        saved = {
          ...saved,
          follow: {
            ...saved.follow,
            revision: 2,
            seen_sequence: body.through_sequence,
            latest_sequence: 206,
            unread_count: 206 - body.through_sequence,
          },
          unread_count: 206 - body.through_sequence,
        };
        return response(saved.follow);
      }
      if (url === '/api/feeds') return response(library([saved]));
      if (url.includes('/updates?'))
        return response({
          items: [update('latest', 205)],
          total: 205,
          next_sequence: 205,
        });
      return response(saved);
    },
  );
  try {
    assert.match(
      content(h.tree.root),
      /newest displayed update and earlier history as read; later arrivals stay unread/,
    );
    await act(async () =>
      button(h.tree, 'Mark updates as read').props.onClick(),
    );
    assert.deepEqual(writes, [
      {
        url: `/api/feeds/${f1}/follow/read`,
        body: { expected_revision: 1, through_sequence: 205 },
      },
    ]);
    assert.match(content(h.tree.root), /1 unread source updates/);
    assert.equal(button(h.tree, 'Mark updates as read'), undefined);
  } finally {
    await h.close();
  }
});

test('unchanged feed settings do not create another revision while invalid changed sources stay actionable', async () => {
  const writes = [];
  const h = await mount(
    FeedForm,
    { catalog, initial: feed(), onSaved() {} },
    async (_url, init) => {
      writes.push(init);
      return response(feed());
    },
  );
  try {
    assert.equal(button(h.tree, 'Save feed settings').props.disabled, true);
    await act(async () => submit(h.tree));
    assert.equal(writes.length, 0);
    await act(async () =>
      h.tree.root
        .findAllByType('textarea')[1]
        .props.onChange({ target: { value: 'http://example.org' } }),
    );
    await act(async () => submit(h.tree));
    assert.match(content(h.tree.root), /public HTTPS/);
    assert.equal(writes.length, 0);
    assert.equal(button(h.tree, 'Save feed settings').props.disabled, false);
  } finally {
    await h.close();
  }
});

test('dossier feed picker searches the entire library without claiming semantic relevance', async () => {
  const reads = [];
  const other = {
    ...feed(f2),
    name: 'Other matters',
    query: 'Which courts announced new decisions?',
  };
  const h = await mount(
    DossierFeeds,
    {
      dossierId: 'dossier',
      name: 'A dossier',
      question: 'Which regulatory changes matter?',
      canEdit: true,
      onChanged: async () => {},
      onResearch() {},
    },
    async (url) => {
      reads.push(url);
      if (url.endsWith('/dossier/feeds'))
        return response({ items: [], can_manage: true });
      if (url.endsWith('/proposal')) return response(proposal());
      if (url.includes('?q=courts')) return response(library([other]));
      return response(library([other, feed()]));
    },
  );
  try {
    await act(async () => button(h.tree, 'Link existing feed').props.onClick());
    assert.doesNotMatch(
      content(h.tree.root),
      /Related words|Suggested|semantic match/,
    );
    const options = h.tree.root.findAllByType('option');
    assert.equal(options[1].props.value, f2);
    await act(async () =>
      h.tree.root
        .findByType('input')
        .props.onChange({ target: { value: 'courts' } }),
    );
    await act(async () =>
      h.tree.root
        .findAllByType('form')[0]
        .props.onSubmit({ preventDefault() {} }),
    );
    assert.ok(reads.includes('/api/feeds?q=courts'));
    assert.equal(h.tree.root.findAllByType('option').length, 2);
  } finally {
    await h.close();
  }
});

test('failed linked research retries its existing checkpoints with a stable command and cannot double unlink', async () => {
  const writes = [];
  let tries = 0;
  let link = {
    can_retry: true,
    can_open_feed: true,
    id: 'link',
    feed_id: f1,
    dossier_id: 'd',
    revision: 7,
    status: 'active',
    cursor_sequence: 0,
    pending_count: 205,
    feed: feed(),
    investigation: { id: 'same-research', status: 'failed', revision: 4 },
  };
  const h = await mount(
    DossierFeeds,
    {
      dossierId: 'd',
      name: 'Dossier',
      question: 'A question',
      canEdit: true,
      onChanged: async () => {},
      onResearch() {},
    },
    async (url, init) => {
      if (init.method === 'POST') {
        writes.push({ url, body: JSON.parse(init.body) });
        link = {
          ...link,
          investigation: { ...link.investigation, status: 'queued' },
        };
        if (++tries === 1) throw Error('Lost acknowledgement');
        return response(link);
      }
      return response({ items: [link], can_manage: true });
    },
  );
  try {
    await act(async () => button(h.tree, 'Retry research').props.onClick());
    assert.equal(button(h.tree, 'Unlink feed').props.disabled, true);
    await act(async () =>
      button(h.tree, 'Retry the same feed action').props.onClick(),
    );
    assert.equal(
      writes[0].url,
      `/api/products/${product.id}/dossiers/d/feeds/link/retry`,
    );
    assert.equal(writes[0].body.expected_revision, 7);
    assert.equal(writes[0].body.investigation_id, 'same-research');
    assert.equal(writes[0].body.expected_investigation_revision, 4);
    assert.deepEqual(writes[1], writes[0]);
    assert.equal(button(h.tree, 'Retry research'), undefined);
    assert.match(content(h.tree.root), /Dossier impact research: queued/);
  } finally {
    await h.close();
  }
});

test('malformed publisher dates remain readable and full older history loads without source duplicates', async () => {
  const reads = [];
  const newest = {
    ...update('latest', 3),
    published_at: 'malformed publisher date',
  };
  const middle = update('middle', 2);
  const h = await mount(
    FeedsWorkspace,
    { selectedId: f1, onSelect() {}, onCreated() {} },
    async (url) => {
      reads.push(url);
      if (url === '/api/feeds') return response(library());
      if (url === `/api/feeds/${f1}`)
        return response({ ...feed(), update_count: 3 });
      if (url.includes('before_sequence=2'))
        return response({
          items: [middle, update('oldest', 1)],
          total: 3,
          next_sequence: null,
        });
      return response({ items: [newest, middle], total: 3, next_sequence: 2 });
    },
  );
  try {
    assert.match(content(h.tree.root), /Discovered/);
    assert.match(content(h.tree.root), /2 of 3 saved updates/);
    await act(async () => button(h.tree, 'Load older updates').props.onClick());
    assert.ok(
      reads.includes(
        `/api/feeds/${f1}/updates?order=newest&view=main&before_sequence=2&limit=50`,
      ),
    );
    assert.match(content(h.tree.root), /3 of 3 saved updates/);
    assert.equal(button(h.tree, 'Load older updates'), undefined);
    assert.equal(h.tree.root.findAllByType('h3').length, 3);
  } finally {
    await h.close();
  }
});

test('collection gaps are available on demand without blocking source history', async () => {
  const reads = [];
  const h = await mount(
    FeedsWorkspace,
    { selectedId: f1, onSelect() {}, onCreated() {} },
    async (url) => {
      reads.push(url);
      if (url === '/api/feeds') return response(library());
      if (url === `/api/feeds/${f1}`)
        return response({
          ...feed(),
          error:
            'Some sources could not be completely checked. Open check history for the retained gaps.',
        });
      if (url.includes('/checks?'))
        return response({
          items: [
            {
              id: 'check',
              status: 'partial',
              feed_revision: 3,
              created_at: '2026-10-14T10:00:00Z',
              finished_at: null,
              progress: {
                captured: 1,
                unchanged: 2,
                portions: 4,
                worker_error: null,
                plan_status: 'ready',
                query_index: 2,
                query_count: 4,
                semantic_counts: {
                  relevant: 1,
                  uncertain: 2,
                  unrelated: 3,
                  unavailable: 4,
                },
                coverage: [
                  {
                    name: 'Official records',
                    query: 'registry protection update',
                    language: 'de',
                    purpose: 'Follow the unresolved scope',
                    status: 'partial',
                    omitted_records: 3,
                  },
                ],
                failures: [
                  {
                    phase: 'read',
                    url: 'https://example.org/blocked',
                    code: 'source_unavailable',
                  },
                  { phase: 'gate', code: 'semantic_context_unavailable' },
                  { phase: 'plan', code: 'semantic_plan_unavailable' },
                ],
              },
            },
          ],
          total: 1,
          offset: 0,
          page_size: 20,
        });
      return response({
        items: [update('saved', 1)],
        total: 1,
        next_sequence: null,
      });
    },
  );
  try {
    assert.equal(
      reads.some((url) => url.includes('/checks')),
      false,
    );
    const summary = h.tree.root
      .findAllByType('summary')
      .find((node) => content(node) === 'Source check history');
    await act(async () =>
      summary.parent.props.onToggle({ currentTarget: { open: true } }),
    );
    assert.match(content(h.tree.root), /3 records not collected/);
    assert.match(content(h.tree.root), /2 of 4 search directions checked/);
    assert.match(
      content(h.tree.root),
      /1 likely relevant · 2 uncertain · 3 outside focus · 4 could not be assessed/,
    );
    assert.match(content(h.tree.root), /registry protection update/);
    assert.match(content(h.tree.root), /Follow the unresolved scope/);
    assert.match(
      content(h.tree.root),
      /Relevance check: semantic context unavailable/,
    );
    assert.match(
      content(h.tree.root),
      /Search preparation: semantic plan unavailable/,
    );
    assert.match(content(h.tree.root), /Source reading: source unavailable/);
    assert.match(content(h.tree.root), /Saved source 1/);
  } finally {
    await h.close();
  }
});

test('dossier editors can unlink but cannot open or retry another owners private feed', async () => {
  const h = await mount(
    DossierFeeds,
    {
      dossierId: 'd',
      name: 'Dossier',
      question: 'A question',
      canEdit: true,
      onChanged: async () => {},
      onResearch() {},
    },
    async () =>
      response({
        items: [
          {
            id: 'link',
            feed_id: f1,
            dossier_id: 'd',
            revision: 1,
            status: 'active',
            cursor_sequence: 0,
            pending_count: 1,
            feed: feed(),
            can_open_feed: false,
            can_retry: false,
            investigation: { id: 'run', status: 'failed' },
          },
        ],
        can_manage: true,
      }),
  );
  try {
    assert.ok(button(h.tree, 'Unlink feed'));
    assert.equal(button(h.tree, 'Retry research'), undefined);
    assert.equal(
      h.tree.root
        .findAllByType('a')
        .some((node) => content(node) === 'Open standalone feed'),
      false,
    );
    assert.ok(button(h.tree, 'Open impact research'));
  } finally {
    await h.close();
  }
});

test('optional search refinement preserves languages, validates intent and retries exact normalized criteria', async () => {
  const writes = [];
  let attempts = 0,
    changed = 0;
  const h = await mount(
    FeedPrecision,
    {
      feed: feed(),
      onChanged: async () => {
        changed++;
      },
    },
    async (url, init) => {
      writes.push({ url, body: JSON.parse(init.body) });
      if (++attempts === 1) throw Error('Response lost');
      return response(feed());
    },
  );
  try {
    assert.equal(button(h.tree, 'Refine search').props.disabled, true);
    await act(async () => submit(h.tree));
    assert.equal(writes.length, 0);
    await act(async () =>
      h.tree.root.findAllByType('textarea')[0].props.onChange({
        target: {
          value: ' Official decisions \nPrimary evidence\nOfficial decisions ',
        },
      }),
    );
    await act(async () =>
      h.tree.root
        .findAllByType('textarea')[1]
        .props.onChange({ target: { value: 'Advertisements' } }),
    );
    await act(async () => submit(h.tree));
    assert.deepEqual(writes[0].body.include, [
      'Official decisions',
      'Primary evidence',
    ]);
    assert.deepEqual(writes[0].body.exclude, ['Advertisements']);
    assert.deepEqual(writes[0].body.languages, ['en', 'de']);
    assert.equal(writes[0].body.expected_revision, 3);
    assert.equal(writes[0].url, `/api/feeds/${f1}/intelligence`);
    assert.equal(h.tree.root.findAllByType('textarea')[0].props.disabled, true);
    await act(async () => submit(h.tree));
    assert.deepEqual(writes[1], writes[0]);
    assert.equal(changed, 1);
  } finally {
    await h.close();
  }
});

test('relevance feedback acknowledges the exact saved verdict and retains uncertainty rather than claiming verification', async () => {
  const writes = [];
  let attempts = 0,
    changed = 0;
  const h = await mount(
    FeedRelevance,
    {
      item: {
        ...update('observation', 4),
        feedback: null,
        relevance: { verdict: 'uncertain', scope: 'Source meaning' },
      },
      feedId: f1,
      feedRevision: 3,
      canManage: true,
      onChanged: async () => {
        changed++;
      },
    },
    async (url, init) => {
      writes.push({ url, body: JSON.parse(init.body) });
      if (++attempts === 1) throw Error('Response lost');
      return response({ ...feed(), revision: 4 });
    },
  );
  try {
    assert.match(content(h.tree.root), /Relevance uncertain/);
    await act(async () => button(h.tree, 'Not relevant').props.onClick());
    assert.equal(button(h.tree, 'Relevant').props.disabled, true);
    await h.update({ feedRevision: 8 });
    await act(async () =>
      button(h.tree, 'Retry the same feedback').props.onClick(),
    );
    assert.deepEqual(writes[1], writes[0]);
    assert.equal(writes[0].body.verdict, 'not_relevant');
    assert.equal(writes[0].body.expected_revision, 3);
    assert.equal(
      writes[0].url,
      `/api/feeds/${f1}/updates/observation/feedback`,
    );
    assert.equal(button(h.tree, 'Not relevant').props['aria-pressed'], true);
    assert.equal(changed, 1);
    assert.match(content(h.tree.root), /Future searches will use it/);
    assert.match(content(h.tree.root), /not a verification/);
  } finally {
    await h.close();
  }
});

test('public dossier context is explicitly previewed and applied with exact fingerprints, never private fields', async () => {
  const calls = [],
    root = `/products/${product.id}/dossiers/d/feeds`;
  let changed = 0;
  const preview = {
    context_fingerprint: 'a'.repeat(64),
    question: 'Which changes matter?',
    findings: [
      {
        statement: 'A sourced finding',
        source_id: 'source',
        url: 'https://example.org/source',
        quote: 'Exact public passage',
        locator: 'Section 1',
      },
    ],
    gaps: ['The effective date is unresolved.'],
    investigation_id: 'run',
    run_revision: 6,
    link_revision: 2,
    feed_revision: 3,
    scope:
      'Only cited public findings; private comments and files are excluded.',
    private_notes: 'DO NOT DISPLAY PRIVATE NOTES',
  };
  const h = await mount(
    FeedDossierContext,
    {
      root,
      linkId: 'link',
      onChanged: async () => {
        changed++;
      },
    },
    async (url, init) => {
      calls.push({
        url,
        method: init.method,
        body: init.body ? JSON.parse(init.body) : null,
      });
      return response(init.method === 'GET' ? preview : feed());
    },
  );
  try {
    assert.equal(calls.length, 0);
    await act(async () =>
      button(h.tree, 'Use dossier context').props.onClick(),
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    assert.match(content(h.tree.root), /A sourced finding/);
    assert.match(content(h.tree.root), /effective date is unresolved/);
    assert.doesNotMatch(content(h.tree.root), /DO NOT DISPLAY PRIVATE NOTES/);
    await act(async () => button(h.tree, 'Use this context').props.onClick());
    assert.equal(calls[1].url, `/api${root}/link/learn`);
    assert.deepEqual(Object.keys(calls[1].body).sort(), [
      'context_fingerprint',
      'expected_feed_revision',
      'expected_link_revision',
      'request_key',
    ]);
    assert.equal(
      calls[1].body.context_fingerprint,
      preview.context_fingerprint,
    );
    assert.equal(calls[1].body.expected_feed_revision, 3);
    assert.equal(calls[1].body.expected_link_revision, 2);
    assert.equal(changed, 1);
    assert.equal(button(h.tree, 'Use this context'), undefined);
  } finally {
    await h.close();
  }
});

test('semantic stream and unrelated archive use server-scoped cursors while full history remains available', async () => {
  const reads = [];
  const h = await mount(
    FeedsWorkspace,
    { selectedId: f1, onSelect() {}, onCreated() {} },
    async (url) => {
      reads.push(url);
      if (url === '/api/feeds') return response(library());
      if (url === `/api/feeds/${f1}`) return response(feed());
      if (url.includes('view=unrelated'))
        return response({
          items: [
            {
              ...update('archived', 2),
              relevance: { verdict: 'unrelated', scope: 'Meaning' },
            },
          ],
          total: 1,
          total_retained: 3,
          next_sequence: null,
        });
      if (url.includes('view=all'))
        return response({
          items: [update('all', 3), update('archived', 2), update('older', 1)],
          total: 3,
          total_retained: 3,
          next_sequence: null,
        });
      return response({
        items: [
          {
            ...update('pending', 3),
            relevance: { verdict: 'unavailable', scope: 'Unavailable' },
          },
        ],
        total: 2,
        total_retained: 3,
        next_sequence: 3,
      });
    },
  );
  try {
    assert.ok(reads.some((url) => url.includes('view=main')));
    assert.match(content(h.tree.root), /Relevance could not be assessed/);
    await act(async () =>
      button(h.tree, 'Other saved sources').props.onClick(),
    );
    assert.ok(reads.some((url) => url.includes('view=unrelated')));
    assert.match(content(h.tree.root), /Outside this feed/);
    assert.doesNotMatch(content(h.tree.root), /Saved source 3/);
    await act(async () => button(h.tree, 'All history').props.onClick());
    assert.ok(reads.some((url) => url.includes('view=all')));
    assert.match(content(h.tree.root), /3 of 3 saved updates/);
    assert.match(content(h.tree.root), /All retained feed history/);
  } finally {
    await h.close();
  }
});

test('changed dossier context requires a fresh reviewed preview before applying a new fingerprint', async () => {
  let revision = 3;
  const writes = [];
  const h = await mount(
    FeedDossierContext,
    {
      root: `/products/${product.id}/dossiers/d/feeds`,
      linkId: 'link',
      onChanged: async () => {},
    },
    async (_url, init) => {
      if (init.method === 'GET')
        return response({
          context_fingerprint: (revision === 3 ? 'a' : 'b').repeat(64),
          question: 'Which public changes matter?',
          findings: [],
          gaps: [],
          feed_revision: revision,
          link_revision: 2,
          run_revision: 1,
          investigation_id: 'run',
          scope: 'Public sources only',
        });
      writes.push(JSON.parse(init.body));
      if (writes.length === 1) {
        revision = 4;
        return response(
          {
            detail:
              'Public dossier context changed. Preview it again before applying.',
          },
          409,
        );
      }
      return response(feed());
    },
  );
  try {
    await act(async () =>
      button(h.tree, 'Use dossier context').props.onClick(),
    );
    await act(async () => button(h.tree, 'Use this context').props.onClick());
    assert.match(content(h.tree.root), /context changed/);
    assert.equal(writes.length, 1);
    await act(async () => button(h.tree, 'Refresh context').props.onClick());
    assert.equal(writes.length, 1);
    await act(async () => button(h.tree, 'Use this context').props.onClick());
    assert.equal(writes[0].context_fingerprint, 'a'.repeat(64));
    assert.equal(writes[1].context_fingerprint, 'b'.repeat(64));
    assert.equal(writes[1].expected_feed_revision, 4);
    assert.notEqual(writes[0].request_key, writes[1].request_key);
  } finally {
    await h.close();
  }
});

test('research-based watch proposal retries its reviewed context exactly and offers no private metadata fields', async () => {
  const writes = [];
  let attempts = 0,
    saved = 0;
  const h = await mount(
    FeedWatchProposal,
    {
      root: `/products/${product.id}/dossiers/d/feeds`,
      onSaved: async () => {
        saved++;
      },
    },
    async (url, init) => {
      if (init.method === 'POST') {
        writes.push({ url, body: JSON.parse(init.body) });
        if (++attempts === 1) throw Error('Response lost');
        return response({ id: 'link', feed_id: f1 });
      }
      return response({
        ...proposal(),
        private_notes: 'DO NOT SHOW PRIVATE NOTES',
      });
    },
  );
  try {
    assert.equal(writes.length, 0);
    assert.doesNotMatch(
      content(h.tree.root),
      /DO NOT SHOW PRIVATE NOTES|Jurisdictions|Parties/,
    );
    await act(async () => submit(h.tree));
    assert.equal(
      button(h.tree, 'Retry the same monitoring').props.disabled,
      false,
    );
    assert.ok(
      h.tree.root
        .findAllByType('textarea')
        .every((node) => node.props.disabled),
    );
    await act(async () => submit(h.tree));
    assert.deepEqual(writes[1], writes[0]);
    assert.equal(
      writes[0].body.proposal_fingerprint,
      'reviewed-public-context',
    );
    assert.equal(saved, 1);
  } finally {
    await h.close();
  }
});

test('question-only watch proposal is honest and a changed public context must be reviewed before applying', async () => {
  const writes = [];
  let reads = 0;
  const h = await mount(
    FeedWatchProposal,
    {
      root: `/products/${product.id}/dossiers/d/feeds`,
      onSaved: async () => {},
    },
    async (url, init) => {
      if (init.method === 'POST') {
        writes.push(JSON.parse(init.body));
        return response(
          { detail: 'Public research changed. Refresh the suggestion.' },
          409,
        );
      }
      return response(
        proposal({
          basis: 'question_only',
          findings: [],
          gaps: [],
          proposal_fingerprint:
            ++reads === 1 ? 'first-question' : 'updated-question',
        }),
      );
    },
  );
  try {
    assert.match(content(h.tree.root), /no completed public research findings/);
    assert.doesNotMatch(content(h.tree.root), /Based on the public findings/);
    await act(async () => submit(h.tree));
    assert.match(content(h.tree.root), /Public research changed/);
    await act(async () => button(h.tree, 'Refresh suggestion').props.onClick());
    await act(async () => submit(h.tree));
    assert.equal(writes[0].proposal_fingerprint, 'first-question');
    assert.equal(writes[1].proposal_fingerprint, 'updated-question');
    assert.notEqual(writes[0].request_key, writes[1].request_key);
  } finally {
    await h.close();
  }
});

test('an uncertain suggested monitor cannot switch to another creation path before its exact retry', async () => {
  let writes = 0;
  const h = await mount(
    DossierFeeds,
    {
      dossierId: 'd',
      name: 'Dossier',
      question: 'Which changes matter?',
      canEdit: true,
      onChanged: async () => {},
      onResearch() {},
    },
    async (url, init) => {
      if (init.method === 'POST') {
        writes++;
        throw Error('Lost response');
      }
      if (url.endsWith('/proposal')) return response(proposal());
      if (url === '/api/feeds') return response(library());
      return response({ items: [], can_manage: true });
    },
  );
  try {
    await act(async () => submit(h.tree));
    assert.equal(writes, 1);
    assert.equal(button(h.tree, 'Link existing feed').props.disabled, true);
    assert.ok(button(h.tree, 'Retry the same monitoring'));
  } finally {
    await h.close();
  }
});
