import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Exercise actual server rendering without a browser or live account. Type
// checking remains the separate full-project gate; this loader only transpiles.
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename;
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
after(() => {
  Module._resolveFilename = originalResolve;
  if (originalCss) Module._extensions['.css'] = originalCss;
  else delete Module._extensions['.css'];
  if (originalTs) Module._extensions['.ts'] = originalTs;
  else delete Module._extensions['.ts'];
  if (originalTsx) Module._extensions['.tsx'] = originalTsx;
  else delete Module._extensions['.tsx'];
});

const { isAskShortcut, askDraftDecision, askBoundary } = require(
  resolve('lib/ask-interaction.ts'),
);
const { AskTrigger } = require(resolve('components/universal-ask-search.tsx'));

const key = (extra = {}) => ({
  key: 'k',
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  repeat: false,
  defaultPrevented: false,
  ...extra,
});
test('Cmd/Ctrl K works without swallowing ordinary typing', () => {
  assert.equal(isAskShortcut(key(), null), true);
  assert.equal(
    isAskShortcut(key({ ctrlKey: false, metaKey: true, key: 'K' }), null),
    true,
  );
  assert.equal(isAskShortcut(key({ ctrlKey: false }), null), false);
  assert.equal(isAskShortcut(key({ key: 'x' }), null), false);
});
test('composition, repeated, modified and already-handled keys keep their owner', () => {
  for (const field of [
    'altKey',
    'shiftKey',
    'isComposing',
    'repeat',
    'defaultPrevented',
  ])
    assert.equal(isAskShortcut(key({ [field]: true }), null), false, field);
});
test('another dialog keeps its shortcut while the global command can refocus', () => {
  assert.equal(isAskShortcut(key(), { getAttribute: () => null }), false);
  assert.equal(isAskShortcut(key(), { getAttribute: () => 'true' }), true);
});
test('preparing a question preserves different drafts and does not enable paused context', () => {
  assert.equal(
    askDraftDecision('Existing work', 'New question', true),
    'conflict',
  );
  assert.equal(
    askDraftDecision('  Existing work ', 'Existing work', true),
    'ready',
  );
  assert.equal(
    askDraftDecision('', 'Where is the primary source?', true),
    'ready',
  );
  assert.equal(askDraftDecision('', 'Question', false), 'unavailable');
  assert.equal(askDraftDecision('', '  ', true), 'unavailable');
  assert.equal(askDraftDecision('', 'x'.repeat(2001), true), 'unavailable');
});
test('draft boundaries separate accounts, workspaces, pages, languages and permissions', () => {
  const base = askBoundary('/sources', 'org', 'person', 'en-CH');
  for (const args of [
    ['/sources', 'org', 'other', 'en-CH'],
    ['/sources', 'other', 'person', 'en-CH'],
    ['/laws/1', 'org', 'person', 'en-CH'],
    ['/sources', 'org', 'person', 'fr-CH'],
    ['/sources', 'org', 'person', 'en-CH', 'viewer'],
  ])
    assert.notEqual(askBoundary(...args), base);
  assert.notEqual(askBoundary('/a:b', 'c'), askBoundary('/a', 'b:c'));
});

test('the actual shared command entry never submits its surrounding form', () => {
  const html = renderToStaticMarkup(
    React.createElement('form', null, React.createElement(AskTrigger)),
  );
  assert.match(html, /type="button"/);
  assert.match(html, /aria-keyshortcuts="Meta\+K Control\+K"/);
  assert.match(html, /Ask Helvetic Lens or search anything/);
});
