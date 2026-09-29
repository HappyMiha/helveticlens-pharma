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
const originalAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(0), 0);
globalThis.cancelAnimationFrame = handle => clearTimeout(handle);
const originalWindow = globalThis.window;
const originalHTMLElement = globalThis.HTMLElement;
globalThis.HTMLElement = class {};
globalThis.document = { cookie: 'helvetic_lens_csrf=fixture' };
globalThis.window = {
  HTMLElement: globalThis.HTMLElement,
  addEventListener() {},
  removeEventListener() {},
};
const { ClaimReviews, ClaimReviewForm, ClaimReviewCard } = require(
  resolve('components/claim-review.tsx'),
);
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
  globalThis.requestAnimationFrame = originalAnimationFrame;
  globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  globalThis.window = originalWindow;
  globalThis.HTMLElement = originalHTMLElement;
});
const citation = {
  id: 'citation',
  claim_id: 'claim',
  relation: 'CONTRADICTS',
  quote: 'Fictional contradictory source',
  locator: 'p1',
  valid: true,
  source: {
    id: 'source',
    investigation_id: 'run',
    title: 'Fictional source',
    url: '',
    kind: 'fixture',
    sha256: 'a'.repeat(64),
    captured_at: '2026-09-29T00:00:00Z',
  },
};
const finding = {
  id: 'claim',
  claim: {
    id: 'claim',
    investigation_id: 'run',
    statement: 'Fictional finding',
    revision: 1,
    evidence_status: 'CONTESTED',
  },
  evidence: [citation],
  comparisons: [],
  complete: true,
  reviewable: true,
  evidence_fingerprint: 'f'.repeat(64),
  limits: { citations: 100, comparisons: 20 },
  revision: 0,
  decision: null,
  stale: false,
  human_status: 'PROPOSED',
  finding_status: 'PENDING_REVIEW',
  history_unavailable: false,
  history: [],
};
const page = {
  items: [finding],
  total: 1,
  offset: 0,
  page_size: 10,
  publication_revision: null,
  can_review: true,
  boundary: 'Evidence and human review are separate.',
};

test('folded findings make no request; choice is explicit; failure retains retry identity and access failure hides evidence', async () => {
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
        React.createElement(ClaimReviews, {
          base: '/products/pharma/dossiers/fixture/claim-reviews',
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
    assert.match(JSON.stringify(tree.toJSON()), /Awaiting human review/);
    const button = (label) =>
      tree.root
        .findAllByType('button')
        .find((node) => node.props.children === label);
    assert.equal(button('Save finding review').props.disabled, true);
    assert.ok(
      tree.root
        .findAllByType('button')
        .filter((node) => node.props['aria-pressed'] !== undefined)
        .every((node) => !node.props['aria-pressed']),
    );
    await act(async () => button('Accept finding').props.onClick());
    await act(async () =>
      tree.root.findByType('textarea').props.onChange({
        target: { value: 'I considered the contradictory fictional source.' },
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
      'I considered the contradictory fictional source.',
    );
    assert.ok(tree.root.findAll((node) => node.props.role === 'alert').length);
    globalThis.fetch = async () => new Response('', { status: 403 });
    await act(async () => button('Reload findings').props.onClick());
    const output = JSON.stringify(tree.toJSON());
    assert.match(output, /Findings are hidden/);
    assert.doesNotMatch(output, /Fictional finding|Save finding review/);
  } finally {
    if (tree) await act(async () => tree.unmount());
    console.error = originalError;
  }
});

const interpretationOptions = {
  schema_version: 1,
  domain_pack: 'LegalPack',
  domain_pack_version: '1.4.0',
  types: [
    {
      kind: 'UNKNOWN',
      claim_type: 'UNCLASSIFIED',
      kind_label: 'Not classified',
      label: 'Not classified',
    },
    {
      kind: 'SOURCE_STATEMENT',
      claim_type: 'CASE_HOLDING',
      kind_label: 'Source statement',
      label: 'Court holding',
    },
    {
      kind: 'AI_INTERPRETATION',
      claim_type: 'AI_ANALYSIS',
      kind_label: 'AI interpretation',
      label: 'AI analysis',
    },
  ],
};
const interpretation = {
  ...interpretationOptions.types[1],
  schema_version: 1,
  domain_pack: 'LegalPack',
  domain_pack_version: '1.4.0',
  authority: 'UNASSESSED',
};

test('review type selection is explicit, preserved on retry, and changing it creates a new request identity', async () => {
  const writes = [];
  globalThis.fetch = async (url, init) => {
    writes.push({ url, init, body: JSON.parse(init.body) });
    return new Response('', { status: 503 });
  };
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(ClaimReviewForm, {
          base: '/fixture',
          value: { ...finding, interpretation },
          options: interpretationOptions,
          publicView: false,
          onSaved() {},
        }),
      );
    });
    const button = (label) =>
      tree.root
        .findAllByType('button')
        .find((node) => node.props.children === label);
    assert.equal(writes.length, 0);
    assert.equal(
      tree.root.findByType('select').props.value,
      'SOURCE_STATEMENT:CASE_HOLDING',
    );
    assert.equal(button('Save finding review').props.disabled, true);
    await act(async () => button('Accept finding').props.onClick());
    await act(async () =>
      tree.root
        .findByType('textarea')
        .props.onChange({ target: { value: 'Fictional evidence assessed.' } }),
    );
    const submit = () =>
      act(async () =>
        tree.root.findByType('form').props.onSubmit({ preventDefault() {} }),
      );
    await submit();
    await submit();
    assert.deepEqual(writes[0].body, writes[1].body);
    assert.deepEqual(writes[0].body.interpretation, {
      schema_version: 1,
      domain_pack_version: '1.4.0',
      kind: 'SOURCE_STATEMENT',
      claim_type: 'CASE_HOLDING',
    });
    await act(async () =>
      tree.root
        .findByType('select')
        .props.onChange({ target: { value: 'AI_INTERPRETATION:AI_ANALYSIS' } }),
    );
    await submit();
    assert.equal(writes[2].body.interpretation.kind, 'AI_INTERPRETATION');
    assert.notEqual(writes[0].body.request_key, writes[2].body.request_key);
    assert.ok(
      writes.every(
        (row) => row.init.method === 'POST' && row.url.endsWith('/review'),
      ),
    );
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('current, historical and stale classifications stay distinct from truth and source authority', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const render = (value) =>
    renderToStaticMarkup(
      React.createElement(ClaimReviewCard, { value, onOpen() {} }),
    );
  assert.match(render(finding), /Not classified/);
  const value = {
    ...finding,
    interpretation: { ...interpretation, label: '<script>fictional</script>' },
    stale: true,
  };
  const html = render(value);
  assert.match(html, /Earlier claim classification/);
  assert.match(
    html,
    /Claim classification alone does not establish source authority or applicability/,
  );
  assert.match(html, /review this classification again/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

const sourceOptions = {
  schema_version: 1,
  domain_pack: 'LegalPack',
  domain_pack_version: '1.4.0',
  limit: 12,
  categories: [
    { category: 'UNASSESSED', label: 'Not assessed' },
    { category: 'PRIMARY_BINDING', label: 'Primary binding material' },
    { category: 'SECONDARY_COMMENTARY', label: 'Secondary commentary' },
  ],
};
const assessed = {
  source_id: 'source',
  evidence_id: 'citation',
  category: 'PRIMARY_BINDING',
  label: 'Primary binding material',
  reason: 'Fictional editor reason <script>example</script>',
  quote: citation.quote,
  locator: citation.locator,
  source: {
    ...citation.source,
    capture_fingerprint: 'f'.repeat(64),
    saved_version: {
      id: 'version',
      recorded_revision: 2,
      current_revision: 2,
      content_hash: 'a'.repeat(64),
    },
  },
};
const sourceAssessments = {
  schema_version: 1,
  domain_pack: 'LegalPack',
  domain_pack_version: '1.4.0',
  method: 'editor_assessment',
  items: [assessed],
};

test('source role form requires a source citation and reason, resets public consent and preserves exact retry identity', async () => {
  const { Checkbox } = require(resolve('components/ui/checkbox.tsx'));
  const writes = [];
  globalThis.fetch = async (url, init) => {
    writes.push(JSON.parse(init.body));
    return new Response('', { status: 503 });
  };
  let tree;
  try {
    await act(async () => {
      tree = create(
        React.createElement(ClaimReviewForm, {
          base: '/fixture',
          value: finding,
          sourceOptions,
          publicView: true,
          onSaved() {},
        }),
      );
    });
    const button = (label) =>
      tree.root
        .findAllByType('button')
        .find((node) => node.props.children === label);
    const select = (suffix) =>
      tree.root
        .findAllByType('select')
        .find((node) => node.props.id.endsWith(suffix));
    const area = (suffix) =>
      tree.root
        .findAllByType('textarea')
        .find((node) => node.props.id.endsWith(suffix));
    await act(async () => button('Accept finding').props.onClick());
    await act(async () =>
      area('-reason').props.onChange({
        target: { value: 'Finding explanation.' },
      }),
    );
    await act(async () =>
      select('-source').props.onChange({ target: { value: 'source' } }),
    );
    await act(async () => button('Add source assessment').props.onClick());
    assert.equal(button('Save finding review').props.disabled, true);
    assert.equal(tree.root.findAllByType('textarea').length, 2);
    await act(async () =>
      select('-role').props.onChange({ target: { value: 'PRIMARY_BINDING' } }),
    );
    await act(async () =>
      select('-citation').props.onChange({ target: { value: 'citation' } }),
    );
    await act(async () =>
      area('-0-reason').props.onChange({
        target: { value: 'Fictional source role basis.' },
      }),
    );
    await act(async () =>
      tree.root.findByType(Checkbox).props.onCheckedChange(true),
    );
    assert.equal(button('Save finding review').props.disabled, false);
    const submit = () =>
      act(async () =>
        tree.root.findByType('form').props.onSubmit({ preventDefault() {} }),
      );
    await submit();
    await submit();
    assert.deepEqual(writes[0], writes[1]);
    assert.deepEqual(writes[0].source_assessments.items, [
      {
        source_id: 'source',
        evidence_id: 'citation',
        category: 'PRIMARY_BINDING',
        reason: 'Fictional source role basis.',
      },
    ]);
    assert.equal(writes[0].confirm_public, true);
    await act(async () =>
      select('-role').props.onChange({
        target: { value: 'SECONDARY_COMMENTARY' },
      }),
    );
    assert.equal(tree.root.findByType(Checkbox).props.checked, false);
    assert.equal(button('Save finding review').props.disabled, true);
    await act(async () =>
      tree.root.findByType(Checkbox).props.onCheckedChange(true),
    );
    await submit();
    assert.notEqual(writes[2].request_key, writes[0].request_key);
    await act(async () => button('Remove source assessment').props.onClick());
    await act(async () =>
      tree.root.findByType(Checkbox).props.onCheckedChange(true),
    );
    await submit();
    assert.deepEqual(writes[3].source_assessments.items, []);
    assert.notEqual(writes[3].request_key, writes[2].request_key);
  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('mixed-source review shows only each captured role and preserves escaped historical basis and saved version', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const other = {
    ...citation,
    id: 'other-citation',
    source: { ...citation.source, id: 'other-source' },
  };
  const value = {
    ...finding,
    evidence: [citation, other],
    stale: true,
    source_assessments: sourceAssessments,
    history: [
      {
        revision: 1,
        decision: 'accepted',
        reason: 'Earlier review',
        at: citation.source.captured_at,
        reviewer: 'Former dossier editor',
        evidence_fingerprint: 'a'.repeat(64),
        basis: {
          schema_version: 1,
          sources: [],
          claims: [],
          source_assessments: sourceAssessments,
        },
      },
    ],
  };
  const html = renderToStaticMarkup(
    React.createElement(ClaimReviewCard, { value, onOpen() {} }),
  );
  assert.match(html, /Earlier source role/);
  assert.match(html, /Source role.*Not assessed/);
  assert.match(html, /recorded revision.*2/);
  assert.match(html, /Fictional editor reason &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /only to this captured source in this finding/);
});

test('saved search never borrows authority from another source in a mixed-source claim', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EvidenceSearchResult } = require(
    resolve('components/evidence-search.tsx'),
  );
  const item = {
    kind: 'claim',
    source_id: 'other-source',
    quote: 'Fictional evidence',
    title: 'Other source',
    claim_status: 'CONTESTED',
    claim_revision: 1,
    url: '',
    created_at: citation.source.captured_at,
    statement: 'Fictional claim',
    relevance_probability: null,
    confidence: null,
    human_review: {
      revision: 1,
      decision: 'accepted',
      stale: false,
      complete: true,
      reviewable: true,
      source_assessments: sourceAssessments,
    },
  };
  const render = (value) =>
    renderToStaticMarkup(
      React.createElement(EvidenceSearchResult, { item: value, onOpen() {} }),
    );
  assert.match(render(item), /Source role.*Not assessed/);
  assert.doesNotMatch(render(item), /Primary binding material/);
  const html = render({ ...item, source_id: 'source' });
  assert.match(html, /Primary binding material.*editor assessment/);
  assert.doesNotMatch(html, /Fictional editor reason/);
});
