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

test('document and direct-source limits remain visible beside the evidence', () => {
  const current = { ...value,
    sources: [{ ...value.sources[0], extraction_methods: ['tesseract-ocr'], extraction_warnings: ['Later scanned pages were not read.'], text_truncated: true }],
    channels: [{ name: 'Official feed', status: 'complete', count: 12, scope: 'Current feed, not an archive search.', more_available: true }],
    saved_evidence: { method: 'BM25 and cited relationships', retrieval: { semantic_status: 'preparation_budget', prepared_records: 128, examined_records: 900 } },
  };
  const html = renderToStaticMarkup(React.createElement(ResearchCoverageReading, { value: current }));
  assert.match(html, /OCR text/);
  assert.match(html, /Later scanned pages were not read/);
  assert.match(html, /not an archive search/);
  assert.match(html, /128 of 900 passages/);
});
test('shared monitoring reading distinguishes a human review from machine support', () => {
  const { MonitoringOutcomeReader } = require(resolve('components/monitoring-outcome.tsx'));
  const outcome = { contract: 'monitoring-outcome/v1', state: 'completed', finding_state: 'findings', limitations: [], comparisons: [], scope: 'Bounded check.',
    findings: [{ id: 'finding', investigation_id: 'run', statement: 'The fictional report changed.', status: 'SUPPORTED', revision: 1,
      human_status: 'UNREVIEWED', review_requirement: { required: true, accepted_for_use: false, reasons: ['unreviewed_interpretation'] },
      evidence: { quote: '<script>untrusted quotation</script>', locator: 'page-1-ocr', source: { title: 'Saved report' } } }], coverage_manifest: value };
  const html = renderToStaticMarkup(React.createElement(MonitoringOutcomeReader, { outcome, onOpen() {} }));
  assert.match(html, /Human review needed before relying on this finding/);
  assert.match(html, /What was checked/);
  assert.match(html, /page-1-ocr/);
  assert.doesNotMatch(html, /<script>/);
});


test('retained analysis describes previous passages without claiming a fresh read', () => {
  for (const status of ['retained_analysis', 'not_started']) {
    const current = { ...value, sources: [{ ...value.sources[0], analysis_status: status }] };
    const html = renderToStaticMarkup(React.createElement(ResearchCoverageReading, { value: current }));
    assert.match(html, status === 'retained_analysis' ? /Previously analysed passages/ : /Prior analysis not recorded/);
    assert.match(html, /Reusing it does not mean the source was checked again/);
    assert.doesNotMatch(html, / · Analysed|Full text read/);
  }
});
