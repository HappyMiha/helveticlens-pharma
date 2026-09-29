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

const { Dossier } = require(resolve('components/dossier.tsx'));
const { InvestigationFindings } = require(
  resolve('components/investigation-findings.tsx'),
);
const { initialDossierSection } = require(resolve('lib/dossier-sections.ts'));
const { emptyConfig } = require(resolve('components/workspace.tsx'));
const id = '11111111-1111-4111-8111-111111111111';
const question = '22222222-2222-4222-8222-222222222222';
function props(extra = {}) {
  return {
    dossier: {
      id,
      profile: {
        id: question,
        status: 'active',
        revision: 1,
        created_at: '2026-09-28T10:00:00Z',
        config: {
          ...emptyConfig(),
          name: 'Medicine safety review',
          sector: 'Pharmaceuticals',
          goal: 'Follow the safety evidence for our next review.',
        },
        topics: [],
        topic_ids: [],
        domain_pack: {
          id: 'PharmaPack',
          version: '1.0.0',
          domain: 'PHARMA',
          label: 'Pharmaceutical monitoring',
          focus: 'Medicines and clinical evidence.',
        },
      },
      entries: [],
      entry_count: 0,
      documents: [],
      discussion: { questions: 0, open_questions: 0 },
      work: { revision: 1 },
      access: {
        audience: 'team',
        can_edit: false,
        can_contribute: false,
        can_monitor: false,
        can_configure: false,
        can_publish: false,
      },
    },
    canEdit: false,
    busy: '',
    run: async () => {},
    reload: async () => {},
    onBack() {},
    onSetup() {},
    onReferenceChange() {},
    notify() {},
    ...extra,
  };
}
const render = (p) => renderToStaticMarkup(React.createElement(Dossier, p));
// Read rendered text outside hidden tab panels, including panels kept mounted
// for global Ask and current research state. No browser or live account needed.
function visibleText(html) {
  const stack = [],
    text = [];
  const voids = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ]);
  for (const token of html.matchAll(
    /<\/?([a-z][a-z0-9:-]*)\b[^>]*>|([^<]+)/gi,
  )) {
    if (token[2]) {
      if (!stack.some((x) => x.hidden)) text.push(token[2]);
      continue;
    }
    const name = token[1].toLowerCase();
    if (token[0].startsWith('</')) {
      const index = stack.map((x) => x.name).lastIndexOf(name);
      if (index >= 0) stack.splice(index);
    } else if (!voids.has(name)) {
      stack.push({
        name,
        hidden:
          /\shidden(?:=|\s|>)/.test(token[0]) ||
          /aria-hidden="true"/.test(token[0]),
      });
    }
  }
  return text.join(' ').replaceAll('<!-- -->', '');
}

test('a dossier opens on its readable document and preserves research outside the visible page', () => {
  const html = render(props()),
    text = visibleText(html);
  assert.match(text, /Medicine safety review/);
  assert.match(text, /Follow the safety evidence/);
  assert.match(text, /01 \/ Dossier/);
  assert.match(text, /What this dossier follows/);
  assert.match(text, /Latest source updates/);
  assert.match(text, /Loading saved source updates/);
  assert.doesNotMatch(text, /Waiting for matching evidence/);
  assert.doesNotMatch(
    text,
    /Research notebook|Contribution type|How this dossier stays up to date|Submit material for AI review/,
  );
  assert.match(html, /Research notebook/); // Mounted research retains the Ask context.
  assert.match(
    html,
    /data-content-kind="ai"[^>]*hidden|hidden[^>]*data-content-kind="ai"/,
  );
  assert.match(html, /aria-label="Dossier chapters"/);
  assert.match(html, /aria-orientation="vertical"/);
  assert.match(text, /Dossier options/);
});

test('source and question deep links open the correct chapter instead of the cover', () => {
  const source = visibleText(render(props({ initialReferenceId: question })));
  assert.match(source, /03 \/ Sources/);
  assert.match(source, /Attached|Dossier files/);
  assert.doesNotMatch(source, /What this dossier follows|Research notebook/);
  const discussion = visibleText(
    render(props({ initialQuestionId: question })),
  );
  assert.match(discussion, /04 \/ Discussion/);
  assert.match(discussion, /Authorship stays with each contribution/);
  assert.doesNotMatch(
    discussion,
    /What this dossier follows|Research notebook/,
  );
  assert.equal(initialDossierSection(null, null, question), 'research');
  assert.equal(initialDossierSection(), 'overview');
});

test('a draft and an older profile remain readable without invented domain or findings', () => {
  const p = props();
  p.dossier.profile.status = 'draft';
  delete p.dossier.profile.domain_pack;
  const text = visibleText(render(p));
  assert.match(text, /Medicine safety review/);
  assert.match(text, /Private draft/);
  assert.doesNotMatch(
    text,
    /Pharmaceutical monitoring|AI has concluded|No changes occurred/,
  );
});

test('an AI interpretation stays distinct from the exact quoted source and its unresolved status', () => {
  const value = {
    entities: [],
    relationships: [],
    sources: [],
    evidence_basis: 'Captured excerpts only',
    claims: [
      {
        id: 'claim',
        statement: 'A working interpretation <untrusted>',
        status: 'UNVERIFIED',
        history: [],
        revision: 1,
      },
    ],
    evidence: [
      {
        id: 'evidence',
        claim_id: 'claim',
        source_id: 'source',
        relation: 'supports',
        quote: 'The source says “uncertain”; <script> is text.',
        locator: 'Paragraph 4',
      },
    ],
  };
  const html = renderToStaticMarkup(
    React.createElement(InvestigationFindings, { value }),
  );
  assert.match(html, /AI interpretation/);
  assert.match(html, /Original source excerpt/);
  assert.match(html, /data-content-kind="ai"/);
  assert.match(html, /data-content-kind="source"/);
  assert.match(html, /href="#source-source"/);
  assert.match(html, /Paragraph 4/);
  assert.match(html, /The source says “uncertain”; &lt;script&gt; is text\./);
  assert.doesNotMatch(html, /<script>|Human accepted|Verified source/);
});

test('a one-question dossier does not send readers back to the old setup questionnaire', () => {
  const p = props();
  p.dossier.profile.status = 'draft';
  p.dossier.research_monitoring = { enabled: true, cadence_hours: 24 };
  const text = visibleText(render(p));
  assert.match(text, /Private dossier/);
  assert.match(text, /Open AI research/);
  assert.match(text, /Optional dossier details/);
  assert.doesNotMatch(
    text,
    /Monitoring has not started|Complete monitoring setup|Private draft/,
  );
});
