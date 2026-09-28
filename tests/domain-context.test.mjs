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

const { DomainContext } = require(resolve('components/domain-context.tsx'));
const { Wizard } = require(resolve('components/wizard.tsx'));
const { emptyConfig } = require(resolve('components/workspace.tsx'));
const pack = {
  id: 'PharmaPack', version: '1.0.0', domain: 'PHARMA',
  label: 'Pharmaceutical monitoring',
  focus: 'Medicines, safety, clinical evidence, regulation and market access relevant to your question.',
};
const render = (element) => renderToStaticMarkup(element);

test('saved direction is readable, escaped and absent when an old server omits it', () => {
  assert.equal(render(React.createElement(DomainContext, {})), '');
  const markup = render(React.createElement(DomainContext, {pack}));
  assert.match(markup, /aria-label="Monitoring direction"/);
  assert.match(markup, /Pharmaceutical monitoring/);
  assert.match(markup, /clinical evidence/);
  assert.doesNotMatch(markup, /PharmaPack|1\.0\.0/);
  assert.doesNotMatch(render(React.createElement(DomainContext, {
    pack: {...pack, label: '<script>unexpected()</script>'},
  })), /<script>/);
});

test('restored wizard reads its saved server direction without deriving it from free text', () => {
  const props = {
    initial: {id: 'draft', profile: {
      id: 'profile', revision: 1, status: 'draft', step: 0,
      config: {...emptyConfig(), name: 'Legal question', sector: 'Legal', goal: 'Legal wording'},
      domain_pack: pack,
    }},
    seed: null, packs: [], emailAvailable: false, identity: {}, busy: '',
    run: async () => {}, onCancel() {}, onSaved: async () => {}, onActivated: async () => {}, onOpenDraft: async () => {},
  };
  const markup = render(React.createElement(Wizard, props));
  assert.match(markup, /Pharmaceutical monitoring/);
  assert.match(markup, /Legal question/);
  delete props.initial.profile.domain_pack;
  const legacy = render(React.createElement(Wizard, props));
  assert.doesNotMatch(legacy, /Monitoring direction/);
  assert.match(legacy, /Legal question/);
});
