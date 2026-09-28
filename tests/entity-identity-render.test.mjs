import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Run the real React reconciler and actual parent, with small stateful children
// standing in for independent network readers. No browser or private data.
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
const originalTs = Module._extensions['.ts'];
const originalTsx = Module._extensions['.tsx'];
const originalFetch = globalThis.fetch;
const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
const originalDocument = globalThis.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
const originalWindow = globalThis.window;
const originalHTMLElement = globalThis.HTMLElement;
globalThis.HTMLElement = class {};
globalThis.document = { cookie: 'helvetic_lens_csrf=fixture' };
globalThis.window = {
  HTMLElement: globalThis.HTMLElement, addEventListener() {}, removeEventListener() {} };
const { EntityIdentities } = require(resolve('components/entity-identity.tsx'));
after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolve;
  for (const [ext, value] of [
    ['.ts', originalTs],
    ['.tsx', originalTsx],
  ]) {
    if (value) Module._extensions[ext] = value;
    else delete Module._extensions[ext];
  }
  globalThis.fetch = originalFetch;
  globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct;
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  globalThis.HTMLElement = originalHTMLElement;
});
const mention = {
  id: 'one',
  investigation_id: 'run-one',
  name: 'Fictional Example',
  kind: 'organization',
  identifier: {
    value: 'DEMO',
    issuer: 'Demo Registry',
    jurisdiction: 'Switzerland',
    kind: 'organization',
  },
  quote: 'Fictional Example DEMO',
  locator: 'p1',
  source: {
    id: 'source',
    title: 'Fictional source',
    url: '',
    kind: 'fixture',
    sha256: 'a'.repeat(64),
    captured_at: '2026-09-28T12:00:00Z',
  },
};
const pair = {
  id: 'one:two',
  entity_id: 'one',
  previous_entity_id: 'two',
  first: mention,
  second: { ...mention, id: 'two' },
  evidence_fingerprint: 'f'.repeat(64),
  exact_identifier_match: true,
  basis: 'Exact source identifiers; not yet reviewed.',
  boundary: 'Originals retained.',
  revision: 0,
  decision: 'unreviewed',
  stale: false,
  history: [],
};
const page = {
  items: [],
  total: 0,
  offset: 0,
  page_size: 20,
  publication_revision: null,
  can_review: true,
  boundary: 'Originals retained.',
  suggestions: {
    items: [pair],
    entities_examined: 2,
    entity_limit: 120,
    entity_window_limited: false,
    suggestion_limit: 30,
    more_suggestions: false,
  },
};

test('folded matching makes no request; review retains input and request key after failure, then access failure hides cached pairs', async () => {
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    if (init.method === 'POST')
      return new Response('unavailable', { status: 503 });
    return Response.json(page);
  };
  let tree;
  const originalError = console.error;
  console.error = (...args) => {
    if (!String(args[0]).includes('react-test-renderer is deprecated'))
      originalError(...args);
  };
  try {
    await act(async () => {
      tree = create(
        React.createElement(EntityIdentities, {
          base: '/products/pharma/dossiers/fixture/entity-identities',
          onOpen() {},
          onChange() {},
        }),
      );
    });
    assert.equal(requests.length, 0);
    await act(async () =>
      tree.root
        .findByType('details')
        .props.onToggle({ currentTarget: { open: true } }),
    );
    assert.equal(requests.length, 1);
    assert.match(JSON.stringify(tree.toJSON()), /Possible match/);
    const button = (label) =>
      tree.root
        .findAllByType('button')
        .find((node) => node.props.children === label);
    await act(async () => button('Same entity').props.onClick());
    await act(async () =>
      tree.root
        .findByType('textarea')
        .props.onChange({
          target: { value: 'Both sources cite the same fictional identifier.' },
        }),
    );
    for (let i = 0; i < 2; i++)
      await act(async () =>
        tree.root.findByType('form').props.onSubmit({ preventDefault() {} }),
      );
    const writes = requests.filter(({ init }) => init.method === 'POST');
    assert.equal(writes.length, 2);
    assert.deepEqual(
      JSON.parse(writes[0].init.body),
      JSON.parse(writes[1].init.body),
    );
    assert.equal(
      tree.root.findByType('textarea').props.value,
      'Both sources cite the same fictional identifier.',
    );
    assert.ok(tree.root.findAll((node) => node.props.role === 'alert').length);
    globalThis.fetch = async () => new Response('', { status: 403 });
    await act(async () => button('Reload entity matches').props.onClick());
    const output = JSON.stringify(tree.toJSON());
    assert.match(output, /Entity matches are hidden/);
    assert.doesNotMatch(output, /Fictional Example|Save identity review/);
  } finally {
    if (tree) await act(async () => tree.unmount());
    console.error = originalError;
  }
});
