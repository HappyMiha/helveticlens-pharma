import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';

// Run from either client root; the file may remain outside the checkout.
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
const { product } = require(resolve('lib/product.ts'));
const config = {
  audience: 'client',
  name: 'A saved monitoring draft',
  sector: 'Fixture context',
  goal: 'Which public rules have changed?',
  feedback: 'Use the current public rules',
  requested_jurisdictions: 'Switzerland',
  topics: [],
  source_pack_ids: [],
  source_requests: [],
  delivery: 'keep',
  delivery_consent: false,
};
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
            Checkbox: 'input',
            NativeSelect: 'select',
            NativeSelectOption: 'option',
          })[key] || wrap,
      },
    );
  // Only independent panels are replaced. Wizard.save, edit tracking,
  // TopicSuggestionsRequest, API transport and polling are real.
  if (
    name === './workspace' &&
    parent?.filename.endsWith('/components/wizard.tsx')
  )
    return {
      ROOT: `/products/${product.id}/dossiers`,
      emptyConfig: () => structuredClone(config),
      Field: wrap,
      Sources: Empty,
    };
  if (
    ['./dossier-template', './domain-context', './public-origin'].includes(name)
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
const { Wizard } = require(resolve('components/wizard.tsx'));
const { TopicSuggestionsRequest } = require(
  resolve('components/topic-suggestions.tsx'),
);
const shown = (tree) => JSON.stringify(tree.toJSON());
const content = (node) =>
  typeof node === 'string' || typeof node === 'number'
    ? String(node)
    : Array.isArray(node)
      ? node.map(content).join('')
      : node?.children
        ? node.children.map(content).join('')
        : '';
function button(tree, label) {
  const found = tree.root
    .findAllByType('button')
    .filter((node) => content(node) === label);
  assert.equal(found.length, 1, `Expected one button: ${label}`);
  return found[0];
}
async function click(tree, label) {
  const target = button(tree, label);
  assert.ok(!target.props.disabled, `Expected enabled: ${label}`);
  await act(async () => target.props.onClick());
}
function feedback(tree) {
  const fields = tree.root
    .findAllByType('textarea')
    .filter((node) => node.props.maxLength === 2000);
  assert.equal(fields.length, 1);
  return fields[0];
}
function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function preventsLeaving(window) {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

for (const editDuringSave of [false, true])
  test(`suggestion save and completion ${editDuringSave ? 'preserve intervening edits and reject stale-context cards' : 'leave an unchanged saved draft clean with usable cards'}`, async () => {
    const saving = deferred();
    const requests = [],
      notifications = [],
      unexpected = [],
      ticks = new Set();
    let latest = null;
    let profile = {
      id: 'profile',
      revision: 5,
      status: 'draft',
      step: 1,
      created_at: '2026-10-05T10:00:00Z',
      config: structuredClone(config),
    };
    const window = new EventTarget();
    window.history = { replaceState() {} };
    window.setInterval = (fn) => {
      ticks.add(fn);
      return fn;
    };
    window.clearInterval = (fn) => ticks.delete(fn);
    globalThis.window = window;
    globalThis.fetch = async (url, init) => {
      const body = init.body ? JSON.parse(init.body) : undefined;
      const call = { url, method: init.method, body };
      requests.push(call);
      if (
        url === '/api/monitoring-profiles/profile/suggestions' &&
        init.method === 'GET'
      )
        return Response.json({ request: latest });
      if (url === '/api/monitoring-profiles/profile' && init.method === 'PUT') {
        if (requests.filter((value) => value.method === 'PUT').length === 1)
          return saving.promise;
        profile = {
          ...profile,
          revision: profile.revision + 1,
          config: body.config,
        };
        return Response.json(profile);
      }
      if (
        url === '/api/monitoring-profiles/profile/suggestions' &&
        init.method === 'POST'
      ) {
        latest = {
          id: 'suggestion-job',
          request_key: body.request_key,
          status: 'queued',
          expected_revision: body.expected_revision,
          error: null,
          result: null,
        };
        return Response.json({ request: latest }, { status: 202 });
      }
      unexpected.push(call);
      throw Error(`Unexpected fixture request: ${init.method} ${typeof url === 'string' ? url : 'non-string URL'}`);
    };
    let tree;
    try {
      await act(async () => {
        tree = create(
          React.createElement(Wizard, {
            initial: { id: 'dossier', profile, access: { audience: 'team' } },
            seed: null,
            creationMode: 'research',
            packs: [],
            emailAvailable: false,
            identity: {
              role: 'organization_admin',
              user: { id: 'owner' },
              organization: { id: 'workspace' },
            },
            busy: '',
            run: async (_label, work) => work(),
            onCancel() {},
            onSaved: async (value) => notifications.push(value),
            onActivated() {},
            onOpenDraft() {},
          }),
        );
      });
      assert.equal(tree.root.findAllByType(TopicSuggestionsRequest).length, 1);
      assert.equal(preventsLeaving(window), false);
      await click(tree, 'Suggest topics');
      const savedInput = requests.find((value) => value.method === 'PUT');
      assert.equal(savedInput.body.expected_revision, 5);
      assert.equal(savedInput.body.config.feedback, config.feedback);
      assert.equal(
        requests.filter((value) => value.method === 'POST').length,
        0,
        'The model job waits for the profile save',
      );
      const edited =
        'My later feedback must remain unsaved until I explicitly save it';
      if (editDuringSave) {
        await act(async () =>
          feedback(tree).props.onChange({ target: { value: edited } }),
        );
        assert.match(shown(tree), /Unsaved changes/);
        assert.equal(preventsLeaving(window), true);
      }
      profile = {
        ...profile,
        revision: 6,
        config: structuredClone(savedInput.body.config),
      };
      await act(async () => saving.resolve(Response.json(profile)));
      const posts = requests.filter((value) => value.method === 'POST');
      assert.equal(posts.length, 1);
      assert.equal(posts[0].body.expected_revision, 6);
      assert.equal(
        posts[0].body.feedback,
        config.feedback,
        'Queued work is bound to the acknowledged snapshot, not a later edit',
      );
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0].profile.revision, 6);
      assert.equal(
        feedback(tree).props.value,
        editDuringSave ? edited : config.feedback,
      );
      assert.equal(preventsLeaving(window), editDuringSave);
      if (editDuringSave) assert.match(shown(tree), /Unsaved changes/);
      else assert.doesNotMatch(shown(tree), /Unsaved changes/);

      profile = { ...profile, revision: 7 };
      latest = {
        ...latest,
        status: 'completed',
        result: {
          profile,
          suggestions: [
            {
              id: 'suggested-topic',
              name: 'Suggested public-rule topic',
              description: 'A proposal for the saved context.',
              keywords: ['public rules'],
              selected: true,
            },
          ],
          provider: 'custom',
          model: 'fixture-model',
        },
      };
      await act(async () => {
        for (const tick of ticks) tick();
      });
      assert.match(shown(tree), /Suggested public-rule topic/);
      assert.equal(
        feedback(tree).props.value,
        editDuringSave ? edited : config.feedback,
      );
      assert.equal(preventsLeaving(window), editDuringSave);
      assert.equal(button(tree, 'Accept').props.disabled, editDuringSave);
      if (editDuringSave) {
        assert.match(shown(tree), /Unsaved changes/);
        assert.match(shown(tree), /Request fresh suggestions/);
      } else assert.doesNotMatch(shown(tree), /Request fresh suggestions/);
      const count = requests.length;
      await act(async () => {
        for (const tick of ticks) tick();
      });
      assert.equal(
        requests.length,
        count,
        'Completed polling does not create or repurchase work',
      );
      assert.equal(
        requests.filter((value) => value.method === 'POST').length,
        1,
      );

      if (editDuringSave) {
        await click(tree, 'Save draft');
        const last = requests.filter((value) => value.method === 'PUT').at(-1);
        assert.equal(
          last.body.expected_revision,
          7,
          'The completed result advances saved revision without replacing the edited config',
        );
        assert.equal(last.body.config.feedback, edited);
        assert.equal(
          preventsLeaving(window),
          false,
          'Only acknowledging the later edit marks it clean',
        );
        assert.doesNotMatch(shown(tree), /Unsaved changes/);
      }
    } finally {
      if (tree) await act(async () => tree.unmount());
      assert.equal(ticks.size, 0, 'Unmount retires the polling lifetime');
      assert.deepEqual(unexpected, []);
    }
  });
