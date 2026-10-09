import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';

// Exercise actual server rendering without a browser or live account. Type
// checking remains the separate full-project gate; this loader only transpiles.
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
const globals = new Map(
  ['fetch', 'window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
    key,
    globalThis[key],
  ]),
);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.document = { cookie: '' };
globalThis.window = new EventTarget();
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
// Mount actual form, resource lifecycle and API transport; primitive wrappers do not need a browser.
const wrap = ({ children }) => React.createElement('div', null, children);
Module._load = function (name, parent, ...args) {
  if (name.includes('/ui/')) {
    const tags = { Button: 'button', Input: 'input', Textarea: 'textarea' };
    return new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'Dialog'
            ? ({ open, children }) =>
                open ? React.createElement('div', null, children) : null
            : tags[key] || wrap,
      },
    );
  }
  if (
    name === './workspace' &&
    parent?.filename === resolve('components/structured-context.tsx')
  )
    return {
      Field: ({ label, children }) =>
        React.createElement('label', null, label, children),
    };
  return originalLoad.call(this, name, parent, ...args);
};
after(() => {
  Module._load = originalLoad;
  for (const [key, value] of globals) globalThis[key] = value;
  Module._resolveFilename = originalResolve;
  if (originalCss) Module._extensions['.css'] = originalCss;
  else delete Module._extensions['.css'];
  if (originalTs) Module._extensions['.ts'] = originalTs;
  else delete Module._extensions['.ts'];
  if (originalTsx) Module._extensions['.tsx'] = originalTsx;
  else delete Module._extensions['.tsx'];
});

const {
  ContextSummary,
  SubjectFields,
  SubjectHistory,
  DossierSubject,
} = require(resolve('components/structured-context.tsx'));
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
  assert.match(html, /Private reference · recorded by your team/);
  assert.match(html, /Product names<\/dt><dd><ul><li>Brand A &lt;script&gt;/);
  assert.match(html, /Active substances<\/dt><dd><ul><li>Substance A/);
  assert.match(html, /Countries \/ markets/);
  assert.doesNotMatch(html, /<script>|confidence|verified source/i);
  const empty = render(ContextSummary, { value: { ...context, values: {} } });
  assert.match(empty, /No private reference details recorded/);
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

const response = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
const shown = (tree) => JSON.stringify(tree.toJSON());
const submit = (tree) =>
  tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
const saveButton = (tree) =>
  tree.root
    .findAllByType('button')
    .find((button) => button.props.type === 'submit');
const fill = (tree, index, value) =>
  tree.root
    .findAllByType('textarea')
    [index].props.onChange({ target: { value } });
async function mounted({
  value = context,
  props: initial = {},
  write,
  read,
  onChanged,
} = {}) {
  let saved = structuredClone(value),
    reads = 0,
    changed = 0;
  const writes = [],
    notices = [];
  globalThis.window = new EventTarget();
  globalThis.fetch = async (url, init) => {
    if (init.method === 'GET') {
      reads++;
      return read ? read(reads, saved) : response(saved);
    }
    const body = JSON.parse(init.body);
    writes.push({ url, body, method: init.method });
    const result = write
      ? await write(body)
      : response({ revision: saved.revision + 1 });
    if (result.ok)
      saved = {
        ...saved,
        values: body.values,
        revision: saved.revision + 1,
        saved: true,
      };
    return result;
  };
  let props = {
    dossierId: 'private-a',
    revision: 2,
    entries: [],
    canEdit: true,
    busy: '',
    onChanged: async () => {
      changed++;
      await onChanged?.();
    },
    notify: (text) => notices.push(text),
    ...initial,
  };
  let tree;
  await act(async () => {
    tree = create(React.createElement(DossierSubject, props));
  });
  return {
    tree,
    writes,
    notices,
    counts: () => ({ reads, changed }),
    edit: async () => {
      await act(async () => {
        tree.root
          .findAllByType('button')
          .find((button) =>
            /(?:Edit|Add) private details/.test(
              React.Children.toArray(button.props.children)
                .filter((child) => typeof child === 'string')
                .join(' '),
            ),
          )
          .props.onClick();
      });
    },
    update: async (changes) => {
      props = { ...props, ...changes };
      await act(async () =>
        tree.update(React.createElement(DossierSubject, props)),
      );
    },
    close: async () => {
      await act(async () => tree.unmount());
    },
  };
}

test('blank and normalized unchanged forms cannot send a save, even by direct submit', async () => {
  for (const empty of [true, false]) {
    const h = await mounted({
      value: empty ? { ...context, values: {}, saved: false } : context,
    });
    try {
      await h.edit();
      assert.equal(saveButton(h.tree).props.disabled, true);
      await act(async () =>
        fill(
          h.tree,
          0,
          empty ? '  \n  ' : ' Brand A <script>\nBrand A <script> ',
        ),
      );
      assert.equal(saveButton(h.tree).props.disabled, true);
      await act(async () => submit(h.tree));
      assert.deepEqual(h.writes, []);
      assert.deepEqual(h.notices, []);
    } finally {
      await h.close();
    }
  }
});

test('empty legacy cards disappear; meaningful cleared history stays readable without another blank questionnaire', async () => {
  const empty = {
    ...context,
    values: { product_names: ['  '], countries: [] },
  };
  const meaningless = {
    id: 'empty-save',
    kind: 'domain_context',
    data: { before: { values: {} }, after: { values: {} } },
  };
  const h = await mounted({
    value: empty,
    props: { hideWhenEmpty: true, entries: [meaningless] },
  });
  try {
    assert.equal(h.tree.toJSON(), null);
    await h.update({
      entries: [
        {
          ...meaningless,
          id: 'clear',
          author: 'Owner',
          created_at: context.updated_at,
          data: {
            revision: 3,
            before: { schema_id: context.schema_id, values: context.values },
            after: { schema_id: context.schema_id, values: {} },
          },
        },
      ],
    });
    assert.match(shown(h.tree), /Private reference history/);
    assert.match(shown(h.tree), /Brand A/);
    assert.doesNotMatch(
      shown(h.tree),
      /Add private details|Edit private details|empty-save/,
    );
  } finally {
    await h.close();
  }
});

test('intentional clearing sends one real update and does not repeat it when view refresh fails', async () => {
  const h = await mounted({
    onChanged: async () => {
      throw Error('View unavailable');
    },
  });
  try {
    await h.edit();
    await act(async () => {
      for (let i = 0; i < 3; i++) fill(h.tree, i, '');
    });
    assert.equal(saveButton(h.tree).props.disabled, false);
    await act(async () => submit(h.tree));
    assert.equal(h.writes.length, 1);
    assert.deepEqual(h.writes[0].body.values, {
      product_names: [],
      active_substances: [],
      countries: [],
    });
    assert.equal(h.writes[0].body.expected_revision, 2);
    assert.equal(h.writes[0].method, 'PUT');
    assert.equal(h.tree.root.findAllByType('form').length, 0);
    assert.match(h.notices.join(' '), /saved.*Refresh the dossier/);
    assert.deepEqual(h.counts(), { reads: 2, changed: 1 });
  } finally {
    await h.close();
  }
});

test('invalid input remains visible and editable, while rejected changes preserve the exact retry identity', async () => {
  let calls = 0;
  const h = await mounted({
    write: async () =>
      ++calls === 1
        ? response({ detail: 'Could not save.' }, 400)
        : response({ revision: 3 }),
  });
  try {
    await h.edit();
    await act(async () => fill(h.tree, 0, 'x'.repeat(241)));
    assert.match(shown(h.tree), /240 characters/);
    assert.equal(saveButton(h.tree).props.disabled, true);
    await act(async () => submit(h.tree));
    assert.equal(h.writes.length, 0);
    await act(async () => fill(h.tree, 0, 'Updated name'));
    await act(async () => submit(h.tree));
    assert.match(shown(h.tree), /Could not save/);
    assert.equal(
      h.tree.root.findAllByType('textarea')[0].props.value,
      'Updated name',
    );
    assert.equal(saveButton(h.tree).props.disabled, false);
    await act(async () => submit(h.tree));
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[0].body.request_key, h.writes[1].body.request_key);
    assert.equal(h.counts().changed, 1);
  } finally {
    await h.close();
  }
});

test('pending saves suppress double submission and lose authority when the session changes', async () => {
  const slow = deferred();
  const h = await mounted({
    write: () => slow.promise,
    read: async (number, saved) =>
      number === 1
        ? response(saved)
        : response({ detail: 'Access denied' }, 403),
  });
  try {
    await h.edit();
    await act(async () => fill(h.tree, 0, 'Private draft'));
    await act(async () => {
      submit(h.tree);
      submit(h.tree);
    });
    assert.equal(h.writes.length, 1);
    assert.equal(saveButton(h.tree).props.disabled, true);
    assert.equal(h.tree.root.findAllByType('textarea')[0].props.disabled, true);
    await act(async () =>
      globalThis.window.dispatchEvent(new Event('helvetic-session-changed')),
    );
    assert.match(shown(h.tree), /Access denied/);
    assert.doesNotMatch(shown(h.tree), /Private draft|Brand A|Substance A/);
    await act(async () => slow.resolve(response({ revision: 3 })));
    assert.deepEqual(h.notices, []);
    assert.equal(h.counts().changed, 0);
  } finally {
    await h.close();
  }
});

test('moving to another dossier discards its open reference editor', async () => {
  const h = await mounted();
  try {
    await h.edit();
    await act(async () => fill(h.tree, 0, 'Old dossier draft'));
    await h.update({ dossierId: 'private-b' });
    assert.equal(h.tree.root.findAllByType('form').length, 0);
    assert.doesNotMatch(shown(h.tree), /Old dossier draft/);
    assert.equal(h.writes.length, 0);
  } finally {
    await h.close();
  }
});

test('existing private annotations are collapsed by default when the dossier hides empty details', async () => {
  const h = await mounted({ props: { hideWhenEmpty: true } });
  try {
    const disclosure = h.tree.root.findByProps({
      className: 'dossier-secondary',
    });
    assert.equal(disclosure.type, 'details');
    assert.equal(disclosure.props.open, undefined);
    assert.equal(
      disclosure.findByType('summary').props.children,
      'Private reference details',
    );
    assert.match(shown(h.tree), /Brand A/);
    await h.edit();
    assert.equal(h.tree.root.findAllByType('form').length, 1);
  } finally {
    await h.close();
  }
});
