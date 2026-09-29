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
const fragment = ({ children }) =>
  React.createElement(React.Fragment, null, children);
Module._load = function (name, parent, ...args) {
  if (parent?.filename.endsWith('/components/research-preview.tsx')) {
    if (name === '@/components/ui/dialog')
      return Object.fromEntries(
        [
          'Dialog',
          'DialogContent',
          'DialogHeader',
          'DialogTitle',
          'DialogDescription',
        ].map((key) => [key, fragment]),
      );
    if (name === '@/components/ui/button')
      return { Button: (props) => React.createElement('button', props) };
    if (name === '@/components/ui/native-select')
      return {
        NativeSelect: (props) => React.createElement('select', props),
        NativeSelectOption: (props) => React.createElement('option', props),
      };
    if (name === './research-source-access')
      return { ResearchSourceAccess: () => null };
  }
  return originalLoad.call(this, name, parent, ...args);
};
const { ResearchPreview } = require(resolve('components/research-preview.tsx'));
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

test('scope choice prepares a fresh preview without inference; failed generation retries keep exact consent', async () => {
  const requests = [];
  globalThis.fetch = (url, init) =>
    new Promise((resolve) => requests.push({ url, init, resolve }));
  const warnings = [];
  const originalError = console.error;
  console.error = (...args) => {
    if (!String(args[0]).includes('react-test-renderer is deprecated'))
      warnings.push(args);
  };
  let tree;
  let saved = 0;
  const preview = (scope) => ({
    evidence_scope: scope,
    dossier_id: 'd',
    question_id: 'q',
    expected_revision: 1,
    evidence_fingerprint: 'a'.repeat(64),
    prepared_at: '2026-09-29T00:00:00Z',
    provider: 'fixture',
    model: 'fixture',
    input: {
      title: 'Fictional question',
      context: '',
      monitoring_goal: '',
      sources: [],
      claims: [],
    },
    selection: {
      team_candidate_limit: 30,
      linked_page_limit: 20,
      topic_limit: 6,
      matches_per_topic: 20,
      snapshot_limit: 18,
      excerpt_char_limit: 1800,
      excluded_urls: 0,
      claim_limit: 2,
      claim_candidates: 0,
      claim_candidate_limit: 12,
      claim_quote_limit: 8,
      omitted_claim_groups: 0,
    },
  });
  const choose = () => tree.root.findByType('select');
  const generate = () =>
    tree.root.findAllByType('button').find((node) =>
      /Draft research gaps/.test(
        React.Children.toArray(node.props.children)
          .filter((child) => typeof child === 'string')
          .join(' '),
      ),
    );
  try {
    await act(async () => {
      tree = create(
        React.createElement(ResearchPreview, {
          dossierId: 'd',
          questionId: 'q',
          canEdit: true,
          onClose() {},
          onSaved: async () => {
            saved++;
          },
        }),
      );
    });
    assert.equal(requests.length, 1);
    assert.ok(requests[0].url.endsWith('evidence_scope=claims_v1'));
    await act(async () =>
      requests[0].resolve(Response.json(preview('claims_v1'))),
    );
    assert.equal(choose().props.value, 'claims_v1');
    await act(async () =>
      choose().props.onChange({ target: { value: 'claims_typed_v1' } }),
    );
    assert.equal(requests.length, 2);
    assert.ok(requests[1].url.endsWith('evidence_scope=claims_typed_v1'));
    assert.ok(generate().props.disabled);
    assert.ok(requests.every((r) => r.init.method === 'GET'));
    await act(async () =>
      requests[1].resolve(Response.json(preview('claims_typed_v1'))),
    );
    assert.ok(
      JSON.stringify(tree.toJSON()).includes(
        'Reviewer explanations, identities and history are not sent',
      ),
    );
    await act(async () => {
      generate().props.onClick();
    });
    assert.equal(requests.length, 3);
    const first = JSON.parse(requests[2].init.body);
    assert.equal(first.evidence_scope, 'claims_typed_v1');
    assert.equal(first.expected_evidence, 'a'.repeat(64));
    assert.equal(Object.keys(first).length, 4);
    await act(async () =>
      requests[2].resolve(new Response('Temporary failure', { status: 503 })),
    );
    assert.equal(saved, 0);
    await act(async () => {
      generate().props.onClick();
    });
    assert.deepEqual(JSON.parse(requests[3].init.body), first);
    await act(async () =>
      requests[3].resolve(new Response('Temporary failure', { status: 503 })),
    );
    await act(async () =>
      choose().props.onChange({ target: { value: 'claims_v1' } }),
    );
    await act(async () =>
      requests[4].resolve(Response.json(preview('claims_v1'))),
    );
    await act(async () => {
      generate().props.onClick();
    });
    const oldScope = JSON.parse(requests[5].init.body);
    assert.equal(oldScope.evidence_scope, 'claims_v1');
    assert.notEqual(oldScope.request_key, first.request_key);
    await act(async () =>
      requests[5].resolve(Response.json({ id: 'saved-note' })),
    );
    assert.equal(saved, 1);
    assert.deepEqual(warnings, []);
  } finally {
    if (tree) await act(async () => tree.unmount());
    console.error = originalError;
  }
});
