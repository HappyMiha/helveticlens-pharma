import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Mount the real source card. The sheet stand-in exposes its existing open and
// finalFocus contracts without needing a browser portal or animation engine.
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename, originalLoad = Module._load;
const originalTs = Module._extensions['.ts'], originalTsx = Module._extensions['.tsx'];
const originalDocument = globalThis.document, originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith('@/') ? resolve(name.slice(2)) : name, ...args);
};
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
function Sheet({ children }) { return React.createElement('div', null, children); }
function SheetContent({ children }) { return React.createElement('aside', null, children); }
function Part({ children }) { return React.createElement('div', null, children); }
Module._load = function (name, parent, ...args) {
  if (parent?.filename.endsWith('/components/source-card.tsx') && name === '@/components/ui/sheet')
    return { Sheet, SheetContent, SheetTrigger: Part, SheetHeader: Part, SheetTitle: Part, SheetDescription: Part };
  return originalLoad.call(this, name, parent, ...args);
};
const { SourceCard } = require(resolve('components/source-card.tsx'));
after(() => {
  Module._resolveFilename = originalResolve;
  Module._load = originalLoad;
  for (const [ext, value] of [['.ts', originalTs], ['.tsx', originalTsx]]) {
    if (value) Module._extensions[ext] = value;
    else delete Module._extensions[ext];
  }
  globalThis.document = originalDocument;
  globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct;
});

const earlier = { id: 'original', kind: 'public_source', title: 'Original capture', url: 'https://example.org/original',
  sha256: 'ab'.repeat(32), snapshot: { excerpts: [{ passage: 'p1', text: 'Exact original passage' }] } };
const duplicate = { ...earlier, id: 'duplicate', snapshot: { ...earlier.snapshot, duplicate_of: earlier.id } };
const value = { sources: [earlier, duplicate], evidence: [] };

async function reader(t, idPrefix) {
  const calls = [], excerpts = { open: false }, classification = { open: false };
  const section = { tagName: 'DETAILS', open: false, parentElement: null };
  const target = {
    parentElement: section,
    querySelector: (selector) => {
      assert.equal(selector, 'details[data-source-excerpts]', 'Open the retained text, not classification metadata');
      return excerpts;
    },
    setAttribute: (key, setting) => calls.push(['attribute', key, setting]),
    scrollIntoView: () => calls.push(['scroll']),
    focus: () => calls.push(['focus']),
  };
  const document = { getElementById: (id) => {
    calls.push(['find', id]);
    assert.equal(id, `${idPrefix}-original`);
    return target;
  } };
  globalThis.document = document;
  let tree;
  await act(async () => { tree = create(React.createElement(SourceCard, { source: duplicate, value, idPrefix })); });
  t.after(async () => { await act(async () => tree.unmount()); globalThis.document = originalDocument; });
  return { tree, calls, target, excerpts, classification, section,
    sheet: () => tree.root.findByType(Sheet),
    content: () => tree.root.findByType(SheetContent),
    click: async (node) => {
      let prevented = false;
      await act(async () => node.props.onClick({ preventDefault() { prevented = true; } }));
      assert.ok(prevented);
    },
  };
}

for (const idPrefix of ['source', 'dossier-original']) test(`inline and modal navigation reveal the earlier capture in ${idPrefix}`, async (t) => {
  const r = await reader(t, idPrefix);
  const href = `#${idPrefix}-original`;
  const inline = r.tree.root.findByProps({ 'data-source-excerpts': true }).findByProps({ href });
  await r.click(inline);
  assert.ok(r.section.open);
  assert.ok(r.excerpts.open);
  assert.equal(r.classification.open, false);
  assert.deepEqual(r.calls, [['find', `${idPrefix}-original`], ['attribute', 'tabindex', '-1'], ['scroll'], ['focus']]);
  r.calls.length = 0;
  r.excerpts.open = false;
  await act(async () => r.sheet().props.onOpenChange(true));
  assert.equal(r.sheet().props.open, true);
  await r.click(r.content().findByProps({ href }));
  assert.equal(r.sheet().props.open, false, 'Dismiss the modal before handing off focus');
  assert.deepEqual(r.calls, [], 'No navigation behind the still-closing dialog');
  const destination = r.content().props.finalFocus();
  assert.equal(destination, r.target, 'BaseUI receives the destination when closing focus is restored');
  assert.ok(r.excerpts.open);
  assert.deepEqual(r.calls, [['find', `${idPrefix}-original`], ['attribute', 'tabindex', '-1'], ['scroll']]);
  assert.equal(r.content().props.finalFocus(), true, 'A later ordinary close returns focus normally');
});

test('a removed source cannot receive a deferred modal focus handoff', async (t) => {
  const r = await reader(t, 'dossier-original');
  await act(async () => r.sheet().props.onOpenChange(true));
  await r.click(r.content().findByProps({ href: '#dossier-original-original' }));
  await act(async () => r.tree.update(React.createElement(SourceCard, {
    source: duplicate, value: { ...value, sources: [duplicate] }, idPrefix: 'dossier-original',
  })));
  assert.equal(r.content().props.finalFocus(), true);
  assert.deepEqual(r.calls, []);
  assert.equal(r.tree.root.findAllByProps({ href: '#dossier-original-original' }).length, 0);
});
