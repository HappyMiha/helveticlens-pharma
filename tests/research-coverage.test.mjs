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

const { ResearchCoverageReading } = require(resolve('components/research-coverage.tsx'));
const { coverageSentence } = require(resolve('lib/research-coverage.ts'));
const value = {
  contract: 'research-coverage/v1', recorded: true, status: 'partial',
  summary: { captured_sources: 1, reused_sources: 1, failed_steps: 0, unavailable_channels: 1, unchecked_sources: 1, open_questions: 1, omitted_candidates: 0 },
  channels: [{ name: 'Direct source', status: 'complete', count: 0 }, { name: 'Web channel', status: 'unavailable', count: 0 }],
  sources: [{ id: 'saved', title: '<script>untrusted title</script>', url: 'javascript:alert(1)', captured_at: '2026-09-01T10:00:00Z', read_status: 'reused', analysis_status: 'not_started', fresh_source_check: false }],
  candidates: [{ title: 'Unread source', url: 'https://example.org/unread', read_status: 'failed' }],
  open_questions: [{ question: 'What remains unknown?', status: 'unresolved' }],
};
test('coverage distinguishes retained, empty, failed and unchecked evidence without unsafe links', () => {
  const markup = renderToStaticMarkup(React.createElement(ResearchCoverageReading, { value }));
  assert.match(markup, /What was checked/);
  assert.match(markup, /Retained evidence/);
  assert.match(markup, /No candidates returned/);
  assert.match(markup, /Unavailable/);
  assert.match(markup, /remain unchecked/);
  assert.match(markup, /What remains unknown/);
  assert.doesNotMatch(markup, /javascript:|<script>/);
  assert.match(coverageSentence(value), /incomplete/);
});
test('unavailable and legacy manifests stay hidden instead of claiming checks', () => {
  for (const current of [null, { ...value, recorded: false }])
    assert.equal(renderToStaticMarkup(React.createElement(ResearchCoverageReading, { value: current })), '');
});
