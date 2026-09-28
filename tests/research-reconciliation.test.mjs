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
function SearchReader() {
  const [query, setQuery] = React.useState('');
  return React.createElement('input', {
    'data-reader': 'saved-search',
    value: query,
    onChange: (event) => setQuery(event.target.value),
  });
}
function HistoryReader() {
  return React.createElement('section', { 'data-reader': 'claim-history' });
}
Module._load = function (name, parent, ...args) {
  if (parent?.filename.endsWith('/components/investigation.tsx')) {
    if (name === './evidence-search') return { EvidenceSearch: SearchReader };
    if (name === './claim-evolution') return { ClaimEvolution: HistoryReader };
  }
  return originalLoad.call(this, name, parent, ...args);
};
const { DossierInvestigation } = require(
  resolve('components/investigation.tsx'),
);
globalThis.document = { getElementById: () => null };
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
});

test('failed reads and repeated recovery retain exactly one search, its typed query and one history reader', async () => {
  const requests = [];
  globalThis.fetch = (url, init) =>
    new Promise((resolve) => requests.push({ url, init, resolve }));
  let tree;
  const warnings = [];
  const originalError = console.error;
  console.error = (...args) => {
    // react-test-renderer is deprecated but matches our pinned React version.
    if (!String(args[0]).includes('react-test-renderer is deprecated'))
      warnings.push(args);
  };
  const expectSingleReaders = () => {
    // Host output, not fiber queries: orphan nodes are absent from the new fiber
    // tree but remain visible to the user after a duplicate-key reconciliation.
    const output = JSON.stringify(tree.toJSON());
    assert.equal(
      (output.match(/"data-reader":"saved-search"/g) || []).length,
      1,
    );
    assert.equal(
      (output.match(/"data-reader":"claim-history"/g) || []).length,
      1,
    );
    assert.equal(
      tree.root.findByType('input').props.value,
      'Retain my question',
    );
  };
  try {
    await act(async () => {
      tree = create(
        React.createElement(DossierInvestigation, {
          dossierId: 'fixture',
          userId: 'reader',
          canEdit: false,
          onOpen() {},
        }),
      );
    });
    await act(async () =>
      tree.root
        .findByType('input')
        .props.onChange({ target: { value: 'Retain my question' } }),
    );
    expectSingleReaders();
    await act(async () =>
      requests[0].resolve(
        new Response('<html>unavailable</html>', { status: 503 }),
      ),
    );
    expectSingleReaders();
    for (let attempt = 0; attempt < 3; attempt++) {
      const retry = tree.root
        .findAllByType('button')
        .find((node) =>
          /Refresh|Reload saved research/.test(String(node.props.children)),
        );
      await act(async () => retry.props.onClick());
      expectSingleReaders();
      await act(async () =>
        requests
          .at(-1)
          .resolve(
            attempt === 2
              ? Response.json({ items: [], total: 0 })
              : new Response('', { status: 502 }),
          ),
      );
      expectSingleReaders();
    }
    assert.equal(
      tree.root.findAll((node) => node.props.role === 'alert').length,
      0,
    );
    assert.equal(requests.length, 4);
    assert.ok(requests.every(({ init }) => init.method === 'GET'));
    assert.deepEqual(warnings, [], 'no duplicate-key or lifecycle warnings');
  } finally {
    if (tree) await act(async () => tree.unmount());
    console.error = originalError;
  }
});
