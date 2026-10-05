import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Real source-review state, resource reader and API. Only UI wrappers are inert.
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
const wrap = ({ children }) => React.createElement('div', null, children);
Module._load = function (name, parent, ...args) {
  if (name === '@/components/action-dialog') return { WorkField: wrap };
  if (name.includes('/ui/'))
    return new Proxy(
      {},
      {
        get: (_target, key) =>
          ({
            Button: 'button',
            Textarea: 'textarea',
            NativeSelect: 'select',
            NativeSelectOption: 'option',
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
const { SourceReviews } = require(resolve('components/source-reviews.tsx'));
const response = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
const before = {
  id: 'review-before',
  body: 'Earlier decision',
  data: { decision: 'include', revision: 1 },
  created_at: '2026-10-01T12:00:00Z',
  author: 'Owner',
};
const saved = {
  ...before,
  id: 'review-saved',
  body: 'Outside the research question',
  data: { decision: 'exclude', revision: 2 },
};
const history = { current: before, items: [before], total: 1 };
function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const shown = (tree) => JSON.stringify(tree.toJSON());
const submit = (tree) =>
  tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
const button = (tree, label) =>
  tree.root
    .findAllByType('button')
    .find((value) => value.props.children === label);
async function mounted({
  write = async () => response(saved),
  refresh = async () => {},
} = {}) {
  globalThis.window = new EventTarget();
  const writes = [],
    refreshes = [];
  let historyResponse = () => response(history),
    closes = 0,
    unmounted = false;
  globalThis.fetch = async (url, init) => {
    if (init.method === 'GET') return historyResponse();
    const body = JSON.parse(init.body);
    writes.push(body);
    return write(body);
  };
  let props = {
    dossierId: 'dossier-a',
    reference: {
      id: 'reference-a',
      title: 'Source',
      url: 'https://example.org/source',
      source_review: before,
    },
    canEdit: true,
    onClose() {
      closes++;
    },
    onSaved: async (value) => {
      refreshes.push(value);
      await refresh(value);
    },
  };
  let tree;
  await act(async () => {
    tree = create(React.createElement(SourceReviews, props));
  });
  await act(async () => {
    tree.root
      .findByType('select')
      .props.onChange({ target: { value: 'exclude' } });
  });
  await act(async () => {
    tree.root
      .findByType('textarea')
      .props.onChange({ target: { value: saved.body } });
  });
  return {
    tree,
    writes,
    refreshes,
    closes: () => closes,
    update: async (patch) => {
      props = { ...props, ...patch };
      await act(async () =>
        tree.update(React.createElement(SourceReviews, props)),
      );
    },
    denyHistory: async () => {
      historyResponse = () => response({ detail: 'Access revoked' }, 403);
      await act(async () =>
        window.dispatchEvent(new Event('helvetic-session-changed')),
      );
    },
    close: async () => {
      if (!unmounted) {
        unmounted = true;
        await act(async () => tree.unmount());
      }
    },
  };
}

test('acknowledged source exclusion retries only the failed view refresh', async () => {
  let attempts = 0;
  const h = await mounted({
    refresh: async () => {
      if (++attempts < 3) throw Error('Dossier read failed');
    },
  });
  try {
    await act(async () => submit(h.tree));
    assert.match(shown(h.tree), /Source decision saved/);
    assert.equal(h.tree.root.findAllByType('form').length, 0);
    assert.equal(h.writes.length, 1);
    for (let i = 0; i < 2; i++)
      await act(async () =>
        button(h.tree, 'Refresh saved decision').props.onClick(),
      );
    assert.equal(h.writes.length, 1);
    assert.equal(h.closes(), 1);
    assert.deepEqual(h.refreshes, [saved, saved, saved]);
  } finally {
    await h.close();
  }
});

test('saved recovery remains read only after current history and edit access are unavailable', async () => {
  let attempts = 0;
  const h = await mounted({
    refresh: async () => {
      if (++attempts === 1) throw Error('Dossier read failed');
    },
  });
  try {
    await act(async () => submit(h.tree));
    await h.update({ canEdit: false });
    await h.denyHistory();
    assert.match(shown(h.tree), /Source decision saved/);
    assert.doesNotMatch(shown(h.tree), /Earlier decision/);
    assert.equal(h.tree.root.findAllByType('form').length, 0);
    await act(async () =>
      button(h.tree, 'Refresh saved decision').props.onClick(),
    );
    assert.equal(h.writes.length, 1);
    assert.equal(h.closes(), 1);
  } finally {
    await h.close();
  }
});

test('unacknowledged failure keeps the decision, explanation and original request identity', async () => {
  let calls = 0;
  const h = await mounted({
    write: async () => {
      if (++calls === 1) throw Error('Response interrupted');
      return response(saved);
    },
  });
  try {
    await act(async () => submit(h.tree));
    assert.doesNotMatch(shown(h.tree), /Source decision saved/);
    assert.equal(h.tree.root.findByType('textarea').props.value, saved.body);
    assert.equal(h.tree.root.findByType('select').props.value, 'exclude');
    await act(async () => submit(h.tree));
    assert.deepEqual(h.writes[1], h.writes[0]);
    assert.equal(h.writes[0].expected_review_id, before.id);
    assert.equal(h.closes(), 1);
  } finally {
    await h.close();
  }
});

test('simultaneous source decision submits make one write', async () => {
  const write = deferred(),
    h = await mounted({ write: () => write.promise });
  try {
    await act(async () => {
      submit(h.tree);
      submit(h.tree);
    });
    assert.equal(h.writes.length, 1);
    await act(async () => write.resolve(response(saved)));
    assert.equal(h.refreshes.length, 1);
  } finally {
    await h.close();
  }
});

test('leaving during a source review write prevents late refresh or close', async () => {
  const write = deferred(),
    h = await mounted({ write: () => write.promise });
  try {
    await act(async () => submit(h.tree));
    await h.close();
    await act(async () => write.resolve(response(saved)));
    assert.equal(h.refreshes.length, 0);
    assert.equal(h.closes(), 0);
  } finally {
    await h.close();
  }
});

test('leaving during the acknowledged view refresh prevents a late close', async () => {
  const refresh = deferred(),
    h = await mounted({ refresh: () => refresh.promise });
  try {
    await act(async () => submit(h.tree));
    assert.equal(h.refreshes.length, 1);
    await h.close();
    await act(async () => refresh.resolve());
    assert.equal(h.closes(), 0);
  } finally {
    await h.close();
  }
});
