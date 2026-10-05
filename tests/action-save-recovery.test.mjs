import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Real modal state and API transport; UI wrappers are inert to avoid a browser.
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename,
  originalLoad = Module._load;
const extensions = new Map(
  ['.ts', '.tsx'].map((ext) => [ext, Module._extensions[ext]]),
);
const globals = new Map(
  ['fetch', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
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
  if (name.includes('/ui/')) {
    const tags = {
      Button: 'button',
      Input: 'input',
      Textarea: 'textarea',
      NativeSelect: 'select',
      NativeSelectOption: 'option',
    };
    return new Proxy({}, { get: (_target, key) => tags[key] || wrap });
  }
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
const { ActionDialog } = require(resolve('components/action-dialog.tsx'));
const response = (value = { id: 'action-a', revision: 8 }, status = 200) =>
  new Response(JSON.stringify(value), { status });
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
const shown = (tree) => JSON.stringify(tree.toJSON());
const title = (tree) =>
  tree.root
    .findAllByType('input')
    .find((input) => input.props.maxLength === 240);
const submit = (tree) =>
  tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
const submitButton = (tree) =>
  tree.root
    .findAllByType('button')
    .find((button) => button.props.type === 'submit');
async function mounted({
  update = false,
  write = async () => response(),
  refresh = async () => {},
} = {}) {
  const writes = [],
    errors = [];
  let refreshes = 0,
    closes = 0;
  globalThis.fetch = async (url, init) => {
    if (init.method === 'GET') return response([]);
    writes.push({ url, method: init.method, body: JSON.parse(init.body) });
    return write();
  };
  let props = {
    dossierId: 'dossier-a',
    canEdit: true,
    busy: '',
    ...(update
      ? {
          action: {
            id: 'action-a',
            title: 'Existing action',
            detail: 'Saved context',
            priority: 'normal',
            status: 'open',
            revision: 7,
            evidence: {},
          },
        }
      : {}),
    run: async (_label, work) => {
      try {
        await work();
      } catch (error) {
        errors.push(error.message);
      }
    },
    onClose: () => {
      closes++;
    },
    onSaved: async () => {
      refreshes++;
      await refresh();
    },
  };
  let tree;
  await act(async () => {
    tree = create(React.createElement(ActionDialog, props));
  });
  if (!update)
    await act(async () => {
      title(tree).props.onChange({ target: { value: 'A follow-up action' } });
    });
  return {
    tree,
    writes,
    errors,
    counts: () => ({ refreshes, closes }),
    update: async (changes) => {
      props = { ...props, ...changes };
      await act(async () =>
        tree.update(React.createElement(ActionDialog, props)),
      );
    },
    close: async () => {
      await act(async () => tree.unmount());
    },
  };
}

for (const update of [false, true])
  test(`acknowledged ${update ? 'update' : 'creation'} retries only failed view reads`, async () => {
    let reads = 0;
    const h = await mounted({
      update,
      refresh: async () => {
        if (++reads < 3) throw Error('view unavailable');
      },
    });
    try {
      await act(async () => {
        submit(h.tree);
      });
      assert.equal(h.writes.length, 1);
      assert.equal(h.writes[0].method, update ? 'PUT' : 'POST');
      if (update) assert.equal(h.writes[0].body.expected_revision, 7);
      assert.match(shown(h.tree), /Action saved\./);
      assert.match(shown(h.tree), /updated view could not be loaded/);
      assert.match(shown(h.tree), /Refresh saved action/);
      for (const input of [
        ...h.tree.root.findAllByType('input'),
        ...h.tree.root.findAllByType('textarea'),
        ...h.tree.root.findAllByType('select'),
      ])
        assert.equal(input.props.disabled, true);
      assert.equal(h.counts().closes, 0);
      await act(async () => {
        submit(h.tree);
      });
      await act(async () => {
        submit(h.tree);
      });
      assert.equal(h.writes.length, 1);
      assert.deepEqual(h.counts(), { refreshes: 3, closes: 1 });
      assert.deepEqual(h.errors, []);
    } finally {
      await h.close();
    }
  });

test('unacknowledged write rejection preserves the draft and creation key for explicit retry', async () => {
  let calls = 0;
  const h = await mounted({
    write: async () =>
      ++calls === 1
        ? response({ detail: 'Could not save this action.' }, 400)
        : response(),
  });
  try {
    await act(async () => {
      submit(h.tree);
    });
    assert.equal(title(h.tree).props.value, 'A follow-up action');
    assert.equal(title(h.tree).props.disabled, false);
    assert.doesNotMatch(shown(h.tree), /Action saved\./);
    assert.equal(h.errors.length, 1);
    assert.equal(h.counts().refreshes, 0);
    await act(async () => {
      submit(h.tree);
    });
    assert.equal(h.writes[0].body.creation_key, h.writes[1].body.creation_key);
    assert.deepEqual(h.counts(), { refreshes: 1, closes: 1 });
  } finally {
    await h.close();
  }
});

test('current edit permission gates writes but does not block reading an acknowledged save', async () => {
  let reads = 0;
  const h = await mounted({
    refresh: async () => {
      if (++reads === 1) throw Error('view unavailable');
    },
  });
  try {
    await h.update({ canEdit: false });
    await act(async () => {
      submit(h.tree);
    });
    assert.equal(h.writes.length, 0);
    await h.update({ canEdit: true });
    await act(async () => {
      submit(h.tree);
    });
    await h.update({ canEdit: false });
    assert.equal(submitButton(h.tree).props.disabled, false);
    await act(async () => {
      submit(h.tree);
    });
    assert.equal(h.writes.length, 1);
    assert.deepEqual(h.counts(), { refreshes: 2, closes: 1 });
  } finally {
    await h.close();
  }
});

test('two immediate submits cannot send concurrent writes', async () => {
  const slow = deferred();
  const h = await mounted({ write: () => slow.promise });
  try {
    await act(async () => {
      submit(h.tree);
      submit(h.tree);
    });
    assert.equal(h.writes.length, 1);
    await act(async () => {
      slow.resolve(response());
    });
    assert.deepEqual(h.counts(), { refreshes: 1, closes: 1 });
  } finally {
    await h.close();
  }
});

test('leaving while a write is pending prevents late refresh and close callbacks', async () => {
  const slow = deferred();
  const h = await mounted({ write: () => slow.promise });
  await act(async () => {
    submit(h.tree);
  });
  await h.close();
  await act(async () => {
    slow.resolve(response());
  });
  assert.equal(h.writes.length, 1);
  assert.deepEqual(h.counts(), { refreshes: 0, closes: 0 });
});

test('leaving during a saved-view refresh cannot close a later dialog', async () => {
  const slow = deferred();
  const h = await mounted({ refresh: () => slow.promise });
  await act(async () => {
    submit(h.tree);
  });
  assert.match(shown(h.tree), /Action saved\./);
  await h.close();
  await act(async () => {
    slow.resolve();
  });
  assert.equal(h.writes.length, 1);
  assert.deepEqual(h.counts(), { refreshes: 1, closes: 0 });
});
