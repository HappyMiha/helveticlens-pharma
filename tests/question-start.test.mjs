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
  if (name === 'next/link') return (props) => React.createElement('a', props);
  if (
    [
      'research-start.tsx',
      'question-monitoring.tsx',
      'dossier-limit-request.tsx',
      'dossier-limit-decision.tsx',
      'dossier-controls.tsx',
      'web-research.tsx',
    ].some((file) => parent?.filename.endsWith('/components/' + file)) &&
    name === './ui/button'
  )
    return { Button: (props) => React.createElement('button', props) };
  if (
    parent?.filename.endsWith('/components/dossier-limit-decision.tsx') &&
    name === './auth-dialog'
  )
    return { AuthDialog: () => null };
  return originalLoad.call(this, name, parent, ...args);
};
const { DossierControls } = require(resolve('components/dossier-controls.tsx'));
const { ResearchStart } = require(resolve('components/research-start.tsx'));
const { DossierLimitDecision } = require(
  resolve('components/dossier-limit-decision.tsx'),
);
const { QuestionMonitoring } = require(
  resolve('components/question-monitoring.tsx'),
);
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
const submit = (tree) =>
  tree.root.findByType('form').props.onSubmit({ preventDefault() {} });
const text = (tree) => JSON.stringify(tree.toJSON());

test('one question survives sign-in, submits once, and retries a lost response without a second dossier', async () => {
  const requests = [],
    navigations = [];
  let signIns = 0,
    tree;
  globalThis.window.location = { assign: (url) => navigations.push(url) };
  globalThis.fetch = (url, init) =>
    url.endsWith('/research-allowance')
      ? Promise.resolve(
          Response.json({
            remaining: 3,
            limit: 3,
            used: 0,
            latest_request: null,
          }),
        )
      : new Promise((resolve) => requests.push({ url, init, resolve }));
  const props = {
    signedIn: false,
    canCreate: false,
    onSignIn: () => signIns++,
  };
  try {
    await act(async () => {
      tree = create(React.createElement(ResearchStart, props));
    });
    assert.equal(tree.root.findAllByType('textarea').length, 1);
    assert.equal(tree.root.findAllByType('input').length, 0);
    assert.equal(tree.root.findAllByType('select').length, 0);
    await act(async () => {
      tree.root.findByType('textarea').props.onChange({
        target: { value: '  What changed in public evidence?  ' },
      });
    });
    await act(async () => {
      submit(tree);
    });
    assert.equal(signIns, 1);
    assert.equal(requests.length, 0);
    await act(async () => {
      tree.update(
        React.createElement(ResearchStart, {
          ...props,
          signedIn: true,
          canCreate: true,
        }),
      );
    });
    assert.equal(
      tree.root.findByType('textarea').props.value,
      '  What changed in public evidence?  ',
    );
    await act(async () => {
      submit(tree);
      submit(tree);
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `/api/products/${product.id}/explore`);
    const command = JSON.parse(requests[0].init.body);
    assert.deepEqual(Object.keys(command).sort(), [
      'public_query_confirmed',
      'question',
      'request_key',
    ]);
    assert.equal(command.question, 'What changed in public evidence?');
    assert.equal(command.public_query_confirmed, true);
    assert.equal(requests[0].init.headers['X-CSRF-Token'], 'fixture');
    await act(async () => {
      requests[0].resolve(Response.json({}, { status: 503 }));
    });
    assert.match(text(tree), /Retry safely/);
    assert.equal(tree.root.findByType('textarea').props.disabled, true);
    await act(async () => {
      submit(tree);
    });
    assert.deepEqual(JSON.parse(requests[1].init.body), command);
    await act(async () => {
      requests[1].resolve(
        Response.json({ dossier_id: 'saved', investigation: { id: 'run' } }),
      );
    });
    assert.deepEqual(navigations, ['/?dossier=saved']);
    assert.doesNotMatch(navigations[0], /What|question=/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('empty questions and read-only workspace roles do not create work', async () => {
  let count = 0,
    tree;
  globalThis.fetch = async () => {
    count++;
    return Response.json({});
  };
  try {
    await act(async () => {
      tree = create(React.createElement(ResearchStart, { canCreate: false }));
    });
    await act(async () => {
      submit(tree);
    });
    await act(async () => {
      tree.root
        .findByType('textarea')
        .props.onChange({ target: { value: 'A complete question' } });
    });
    await act(async () => {
      submit(tree);
    });
    assert.equal(count, 0);
    assert.match(text(tree), /administrator can start/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

const page = (changes = {}) => ({
  dossier_id: 'd',
  can_manage: true,
  items: [],
  total: 0,
  policy: {
    enabled: true,
    revision: 1,
    question: 'A public question',
    cadence_hours: 24,
    readiness: { configured: true, reason: 'Configured' },
    next_run_at: null,
    ...changes,
  },
});
const button = (tree, label) =>
  tree.root
    .findAllByType('button')
    .find((node) => node.children.join('') === label);

test('pause and resume use the saved question and revision; unavailable reads hide controls', async () => {
  let tree,
    saved = page(),
    changes = 0,
    unreadable = false;
  const writes = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, `/api/products/${product.id}/dossiers/d/web-research`);
    if (init.method === 'POST') {
      const command = JSON.parse(init.body);
      writes.push(command);
      assert.equal(command.expected_revision, saved.policy.revision);
      saved = page({
        ...saved.policy,
        enabled: command.enabled,
        revision: command.expected_revision + 1,
      });
      return Response.json(saved);
    }
    return unreadable
      ? Response.json({}, { status: 403 })
      : Response.json(saved);
  };
  try {
    await act(async () => {
      tree = create(
        React.createElement(QuestionMonitoring, {
          dossierId: 'd',
          onChanged: async () => {
            changes++;
          },
        }),
      );
    });
    await act(async () => {
      button(tree, 'Pause monitoring').props.onClick();
    });
    assert.match(text(tree), /Monitoring is paused/);
    assert.equal(writes[0].enabled, false);
    assert.equal(writes[0].standing_public_query_confirmed, false);
    assert.equal(writes[0].question, 'A public question');
    await act(async () => {
      button(tree, 'Resume monitoring').props.onClick();
    });
    assert.equal(writes[1].enabled, true);
    assert.equal(writes[1].standing_public_query_confirmed, true);
    assert.equal(changes, 2);
    unreadable = true;
    await act(async () => {
      button(tree, 'Pause monitoring').props.onClick();
    });
    assert.equal(button(tree, 'Resume monitoring'), undefined);
    assert.equal(button(tree, 'Pause monitoring'), undefined);
    assert.match(text(tree), /Refresh monitoring/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('missing providers are shown as waiting, never as a successful check', async () => {
  let tree;
  globalThis.fetch = async () =>
    Response.json(
      page({
        readiness: {
          configured: false,
          reason: 'Search provider is not configured.',
        },
      }),
    );
  try {
    await act(async () => {
      tree = create(
        React.createElement(QuestionMonitoring, {
          dossierId: 'd',
          onChanged: async () => {},
        }),
      );
    });
    assert.match(text(tree), /waiting for setup/);
    assert.match(text(tree), /Search provider is not configured/);
    assert.doesNotMatch(text(tree), /Monitoring is on|Next scheduled check/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('daily research counts as monitoring while creator privacy stays a draft; native monitoring remains independent', () => {
  const { dossierStatus } = require(resolve('lib/dossier-status.ts'));
  const doc = {
    profile: { status: 'draft' },
    research_monitoring: { enabled: true },
  };
  assert.equal(dossierStatus(doc), 'active');
  doc.research_monitoring.enabled = false;
  assert.equal(dossierStatus(doc), 'paused');
  doc.profile.status = 'active';
  assert.equal(dossierStatus(doc), 'active');
  assert.equal(dossierStatus({ profile: { status: 'draft' } }), 'draft');
  assert.equal(
    dossierStatus({
      profile: { status: 'draft' },
      exploration: { investigation_id: 'r' },
    }),
    'research',
  );
});

test('a full shared allowance offers a reasoned request without starting another dossier', async () => {
  let tree;
  const writes = [];
  globalThis.fetch = async (url, init) => {
    if (init.method === 'GET')
      return Response.json({
        used: 3,
        limit: 3,
        remaining: 0,
        latest_request: null,
      });
    assert.equal(url, `/api/products/${product.id}/dossier-limit-requests`);
    const data = JSON.parse(init.body);
    writes.push(data);
    return Response.json({
      id: 'request',
      ...data,
      status: 'pending',
      revision: 1,
      approved_limit: null,
      mail_state: 'queued',
    });
  };
  try {
    await act(async () => {
      tree = create(React.createElement(ResearchStart));
    });
    assert.match(text(tree), /shared across Legal and Pharma/);
    await act(async () => {
      tree.root
        .findByType('textarea')
        .props.onChange({ target: { value: 'A fourth research question' } });
    });
    assert.equal(
      tree.root.findAllByType('button').find((b) => b.props.type === 'submit')
        .props.disabled,
      true,
    );
    await act(async () => {
      button(tree, 'Request a higher limit').props.onClick();
    });
    await act(async () => {
      tree.root
        .findByProps({ id: 'requested-dossier-limit' })
        .props.onChange({ target: { value: '7' } });
      tree.root
        .findByProps({ id: 'dossier-limit-reason' })
        .props.onChange({
          target: { value: 'We need separate project dossiers.' },
        });
    });
    await act(async () => {
      tree.root
        .findAllByType('form')[1]
        .props.onSubmit({ preventDefault() {} });
    });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].requested_limit, 7);
    assert.equal(writes[0].reason, 'We need separate project dossiers.');
    assert.match(text(tree), /awaiting a decision/);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('email review is read-only until an administrator confirms an alternative total', async () => {
  let tree;
  const writes = [];
  const request = {
    id: 'request',
    requested_limit: 8,
    reason: 'Separate project dossiers.',
    status: 'pending',
    revision: 1,
    approved_limit: null,
    mail_state: 'sent',
    user: { name: 'Ada', email: 'ada@example.org' },
    allowance: { used: 3, limit: 3, remaining: 0, latest_request: null },
  };
  globalThis.window.location = { search: '?action=adjust' };
  globalThis.fetch = async (_url, init) => {
    if (init.method === 'GET') return Response.json(request);
    const body = JSON.parse(init.body);
    writes.push(body);
    return Response.json({
      ...request,
      status: 'approved',
      approved_limit: body.limit,
    });
  };
  try {
    await act(async () => {
      tree = create(
        React.createElement(DossierLimitDecision, { id: 'request' }),
      );
    });
    assert.equal(writes.length, 0);
    assert.equal(
      tree.root.findByProps({ id: 'limit-decision' }).props.value,
      'adjust',
    );
    await act(async () => {
      tree.root
        .findByProps({ id: 'approved-limit' })
        .props.onChange({ target: { value: '6' } });
    });
    await act(async () => {
      submit(tree);
    });
    assert.deepEqual(writes, [
      { expected_revision: 1, action: 'approve', limit: 6 },
    ]);
    assert.match(text(tree), /6 dossiers/);
    assert.equal(tree.root.findAllByType('form').length, 0);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('one dossier surface requires explicit email consent and saves only personal preferences', async () => {
  let tree;
  let personal = {
    dossier_id: 'd',
    following: false,
    available: true,
    revision: 0,
    delivery_mode: 'immediate',
    email: { mode: 'off', state: null },
    research: { total: 0, unseen: 0, latest_at: null },
  };
  const writes = [];
  globalThis.window.dispatchEvent = () => {};
  globalThis.fetch = async (url, init) => {
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      writes.push({ url, body });
      personal = {
        ...personal,
        following: body.following,
        revision: personal.revision + 1,
        delivery_mode: body.delivery_mode,
        email: { mode: body.email_mode, state: 'enabled' },
      };
      return Response.json(personal);
    }
    return Response.json(
      url.endsWith('/follow') ? personal : { ...page(), can_manage: false },
    );
  };
  try {
    await act(async () => {
      tree = create(
        React.createElement(DossierControls, {
          dossierId: 'd',
          question: 'A complex question',
          onChanged: async () => {},
        }),
      );
    });
    assert.equal(writes.length, 0);
    assert.match(text(tree), /Keep this dossier current/);
    const email = tree.root.findByProps({
      'aria-label': 'Email dossier updates',
    });
    await act(async () =>
      email.props.onChange({ target: { value: 'weekly' } }),
    );
    assert.equal(button(tree, 'Save my updates').props.disabled, true);
    await act(async () =>
      tree.root
        .findByType('input')
        .props.onChange({ target: { checked: true } }),
    );
    assert.equal(button(tree, 'Save my updates').props.disabled, false);
    await act(async () => submit(tree));
    assert.equal(writes.length, 1);
    assert.ok(writes[0].url.endsWith('/follow'));
    assert.equal(writes[0].body.email_mode, 'weekly');
    assert.equal(writes[0].body.email_confirmed, true);
    assert.match(text(tree), /preferences are saved/);
    await act(async () =>
      tree.root
        .findByProps({ 'aria-label': 'Email dossier updates' })
        .props.onChange({ target: { value: 'off' } }),
    );
    assert.equal(button(tree, 'Save my updates').props.disabled, false);
    await act(async () => submit(tree));
    assert.equal(writes[1].body.email_mode, 'off');
    assert.equal(writes[1].body.email_confirmed, false);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});
