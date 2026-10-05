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
Module._load = function (name, parent, ...args) {
  if (name.endsWith('/ui/button'))
    return { Button: (props) => React.createElement('button', props) };
  return originalLoad.call(this, name, parent, ...args);
};
const { TopicSuggestionsRequest } = require(
  resolve('components/topic-suggestions.tsx'),
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
const profile = {
  id: 'profile',
  revision: 5,
  config: { goal: 'A public question' },
};
const job = (status, extra = {}) => ({
  id: 'job',
  request_key: 'key',
  status,
  expected_revision: 5,
  error: null,
  result: null,
  ...extra,
});
const text = (tree) => JSON.stringify(tree.toJSON());
function deferred() {
  let resolve;
  const promise = new Promise((yes) => (resolve = yes));
  return { promise, resolve };
}
async function mount({ initial = null, post } = {}) {
  const calls = [],
    results = [],
    ticks = new Set();
  let latest = initial,
    saves = 0,
    tree;
  globalThis.window = {
    setInterval(fn) {
      ticks.add(fn);
      return fn;
    },
    clearInterval(fn) {
      ticks.delete(fn);
    },
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (init.method === 'POST')
      return post
        ? post(init)
        : Response.json({
            request: job('queued', {
              request_key: JSON.parse(init.body).request_key,
            }),
          });
    return latest instanceof Response
      ? latest.clone()
      : Response.json({ request: latest });
  };
  const props = {
    profile,
    feedback: 'Focus',
    disabled: false,
    onReload: () => {},
    save: async () => {
      saves++;
      return { id: 'dossier', profile };
    },
    onResult: (value) => results.push(value),
  };
  await act(async () => {
    tree = create(React.createElement(TopicSuggestionsRequest, props));
  });
  return {
    tree,
    calls,
    results,
    props,
    saves: () => saves,
    button: (label) =>
      tree.root.findAllByType('button').find((b) => b.props.children === label),
    latest: (value) => {
      latest = value;
    },
    tick: async () => {
      await act(async () => {
        for (const fn of ticks) fn();
      });
    },
    close: async () => {
      await act(async () => tree.unmount());
    },
  };
}

test('busy model leaves a saved request, resumes polling and restores exact completed cards on reopen', async () => {
  const result = {
    profile: { ...profile, revision: 6 },
    suggestions: [{ id: 'card', name: 'Verified suggestion' }],
    provider: 'custom',
    model: 'gpt-6-astra',
  };
  const h = await mount({ initial: job('waiting') });
  try {
    assert.match(text(h.tree), /waiting for AI/);
    assert.equal(h.button('Preparing suggestions…').props.disabled, true);
    await h.tick();
    assert.equal(h.calls.filter((c) => c.init.method === 'POST').length, 0);
    h.latest(job('completed', { result }));
    await h.tick();
    assert.deepEqual(h.results, [result]);
    const count = h.calls.length;
    await h.tick();
    assert.equal(h.calls.length, count);
  } finally {
    await h.close();
  }
  const reopened = await mount({ initial: job('completed', { result }) });
  try {
    assert.deepEqual(reopened.results, [result]);
    assert.equal(reopened.saves(), 0);
  } finally {
    await reopened.close();
  }
});

test('double click enqueues once and a lost response retry preserves the same saved revision and request key', async () => {
  const first = deferred();
  let attempts = 0;
  const h = await mount({
    post: async (init) =>
      ++attempts === 1
        ? first.promise
        : Response.json({
            request: job('queued', {
              request_key: JSON.parse(init.body).request_key,
            }),
          }),
  });
  try {
    let pending;
    await act(async () => {
      const button = h.button('Suggest topics');
      pending = button.props.onClick();
      button.props.onClick();
    });
    assert.equal(h.saves(), 1);
    assert.equal(attempts, 1);
    await act(async () => {
      first.resolve(Response.json({}, { status: 503 }));
      await pending;
    });
    await act(async () => h.button('Retry same request').props.onClick());
    const posts = h.calls.filter((c) => c.init.method === 'POST');
    assert.equal(posts.length, 2);
    assert.equal(posts[0].init.body, posts[1].init.body);
    assert.equal(h.saves(), 1);
    assert.match(text(h.tree), /request is saved/);
  } finally {
    await h.close();
  }
});

test('read failure requires checking saved status before a new request and performs no retry writes', async () => {
  const h = await mount({ initial: Response.json({}, { status: 503 }) });
  try {
    assert.equal(h.button('Suggest topics').props.disabled, true);
    const count = h.calls.length;
    await h.tick();
    assert.equal(h.calls.length, count);
    h.latest(null);
    await act(async () => h.button('Check saved request').props.onClick());
    assert.equal(h.button('Suggest topics').props.disabled, false);
    assert.equal(h.saves(), 0);
  } finally {
    await h.close();
  }
});

test('a superseded request never applies old suggestions or creates another request automatically', async () => {
  const h = await mount({ initial: job('superseded') });
  try {
    assert.match(text(h.tree), /saved question changed/);
    assert.deepEqual(h.results, []);
    await h.tick();
    assert.equal(h.calls.length, 1);
    assert.equal(h.saves(), 0);
  } finally {
    await h.close();
  }
});

test('a completion after leaving the setup cannot apply results to another screen', async () => {
  const reply = deferred();
  const h = await mount({ post: () => reply.promise });
  await act(async () => h.button('Suggest topics').props.onClick());
  await h.close();
  await act(async () =>
    reply.resolve(
      Response.json({
        request: job('completed', { result: { profile, suggestions: [] } }),
      }),
    ),
  );
  assert.deepEqual(h.results, []);
});

test('a save conflict keeps edits and requires an explicit saved-version reload, not an automatic rebase', async () => {
  const h = await mount();
  let reloads = 0;
  try {
    await act(async () =>
      h.tree.update(
        React.createElement(TopicSuggestionsRequest, {
          ...h.props,
          onReload: () => reloads++,
          save: async () => {
            const { ApiError } = require(resolve('lib/api.ts'));
            throw new ApiError('Draft changed.', 409);
          },
        }),
      ),
    );
    await act(async () => h.button('Suggest topics').props.onClick());
    assert.equal(h.button('Suggest topics').props.disabled, true);
    await act(async () => h.button('Check saved request').props.onClick());
    assert.equal(
      h.button('Suggest topics').props.disabled,
      true,
      'Checking a job must not pretend to reload the profile',
    );
    assert.equal(reloads, 0);
    await act(async () => h.button('Reload saved dossier').props.onClick());
    assert.equal(reloads, 1);
    assert.equal(h.calls.filter((c) => c.init.method === 'POST').length, 0);
  } finally {
    await h.close();
  }
});
