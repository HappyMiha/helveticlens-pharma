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

const { ResearchQuestions } = require(
  resolve('components/research-questions.tsx'),
);
const { ResearchStart } = require(resolve('components/research-start.tsx'));
const {
  nextResearchLimits,
  defaultResearchLimits,
  maximumResearchLimits,
} = require(resolve('lib/research-engine.ts'));
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));

test('question-first creation asks no mandatory sources, topics or monitoring rules', () => {
  const html = render(ResearchStart, { onMonitoring() {}, onCancel() {} });
  assert.match(html, /Your question/);
  assert.match(html, /daily checks/);
  assert.match(html, /Set up topics and sources manually/);
  assert.match(
    html,
    /<button[^>]*disabled[^>]*>Start research &amp; monitoring/,
  );
  assert.equal((html.match(/<textarea/g) || []).length, 1);
  assert.doesNotMatch(
    html,
    /Dossier title|<select|type="checkbox"|source_pack_ids|Jev hosted|Laya local/,
  );
});

test('follow-up reader links exact trigger and new evidence without claiming resolution', () => {
  const html = render(ResearchQuestions, {
    value: {
      research: {
        questions: [
          {
            id: 'q',
            question: '<script>Does the recipient agree?',
            purpose: 'Check the amount.',
            parent_branch_id: 'parent',
            status: 'evidence_found',
            claim_id: 'claim',
            answer_evidence_ids: ['new'],
            trigger: {
              quote: 'A source says CHF 50,000.',
              source_id: 'original',
              locator: 'p1',
            },
          },
        ],
      },
      evidence: [
        {
          id: 'new',
          claim_id: 'claim',
          source_id: 'recipient',
          relation: 'CONTRADICTS',
        },
      ],
    },
  });
  assert.match(html, /New evidence found/);
  assert.match(html, /Follow-up from source evidence/);
  assert.match(html, /href="#source-original"/);
  assert.match(html, /href="#source-recipient"/);
  assert.match(html, /href="#claim-claim"/);
  assert.match(html, /Contradicts an existing claim/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|Verified truth|Question resolved/);
});

test('pending budget questions remain visible and have no invented evidence links', () => {
  const html = render(ResearchQuestions, {
    value: {
      research: {
        questions: [
          {
            id: 'q',
            question: 'Who received the grant?',
            purpose: 'Find recipient documentation.',
            status: 'open',
            waiting_reason: 'branch_budget',
            parent_branch_id: 'parent',
            claim_id: null,
            trigger: null,
          },
        ],
      },
      evidence: [],
    },
  });
  assert.match(html, /Waiting to investigate/);
  assert.match(html, /additional research budget/);
  assert.doesNotMatch(html, /href="#source-|New source evidence/);
});

test('continuation respects server ceilings and does not mutate saved limits', () => {
  const original = { ...defaultResearchLimits };
  const next = nextResearchLimits(original);
  assert.equal(next.branches, 16);
  assert.equal(next.sources_per_branch, original.sources_per_branch);
  assert.deepEqual(original, defaultResearchLimits);
  assert.deepEqual(
    nextResearchLimits(maximumResearchLimits),
    maximumResearchLimits,
  );
});
