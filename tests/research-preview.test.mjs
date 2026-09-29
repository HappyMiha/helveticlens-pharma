import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-research-preview-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/research-preview.ts',
  '--outDir',
  build,
  '--target',
  'es2022',
  '--module',
  'commonjs',
  '--skipLibCheck',
  '--esModuleInterop',
]);
const require = createRequire(import.meta.url);
const { researchRequest, hasClaimInputs } = require(
  join(build, 'research-preview.js'),
);
after(() => rmSync(build, { recursive: true, force: true }));

test('generation forwards only reviewed input identity and preserves exact retry keys', () => {
  let count = 0;
  const key = () => `request-${++count}`;
  const keys = new Map();
  const preview = {
    dossier_id: 'topic',
    question_id: 'question',
    expected_revision: 3,
    evidence_fingerprint: 'a'.repeat(64),
    input: { title: 'private question', sources: ['private source'] },
    provider: 'do-not-forward',
    sources: ['forged snippet'],
  };
  const request = researchRequest(preview, keys, key);
  assert.deepEqual(request, {
    request_key: 'request-1',
    expected_revision: 3,
    expected_evidence: 'a'.repeat(64),
  });
  assert.deepEqual(
    researchRequest(
      { ...preview, input: { title: 'edited in browser' } },
      keys,
      key,
    ),
    request,
  );
  assert.equal(count, 1);
  for (const change of [
    { evidence_fingerprint: 'b'.repeat(64) },
    { expected_revision: 4 },
    { question_id: 'different' },
    { dossier_id: 'different' },
  ]) {
    assert.notEqual(
      researchRequest({ ...preview, ...change }, keys, key).request_key,
      request.request_key,
    );
  }
  assert.doesNotMatch(
    JSON.stringify(request),
    /private|forged|do-not-forward|input|sources/,
  );
});

test('missing or malformed previews never downgrade to unreviewed generation', () => {
  const valid = {
    dossier_id: 'topic',
    question_id: 'question',
    expected_revision: 1,
    evidence_fingerprint: 'f'.repeat(64),
  };
  for (const change of [
    { evidence_fingerprint: '' },
    { evidence_fingerprint: null },
    { evidence_fingerprint: 'not-a-digest' },
    { evidence_fingerprint: 'a'.repeat(65) },
    { expected_revision: 0 },
    { expected_revision: 1.5 },
    { question_id: '' },
    { dossier_id: '' },
  ]) {
    assert.throws(
      () => researchRequest({ ...valid, ...change }, new Map(), () => 'key'),
      /Refresh/,
    );
  }
});

test('claim input consent is explicit, versioned and retry keys never cross scopes', () => {
  const legacy = {
    dossier_id: 'd',
    question_id: 'q',
    expected_revision: 1,
    evidence_fingerprint: 'a'.repeat(64),
  };
  let count = 0;
  const keys = new Map();
  const key = () => String(++count);
  const first = researchRequest(legacy, keys, key);
  const claims = researchRequest(
    { ...legacy, evidence_scope: 'claims_v1' },
    keys,
    key,
  );
  assert.equal(claims.evidence_scope, 'claims_v1');
  assert.notEqual(first.request_key, claims.request_key);
  assert.deepEqual(
    researchRequest({ ...legacy, evidence_scope: 'claims_v1' }, keys, key),
    claims,
  );
  const typed = researchRequest(
    { ...legacy, evidence_scope: 'claims_typed_v1' },
    keys,
    key,
  );
  assert.equal(typed.evidence_scope, 'claims_typed_v1');
  assert.notEqual(typed.request_key, claims.request_key);
  assert.notEqual(typed.request_key, first.request_key);
  assert.deepEqual(
    researchRequest(
      { ...legacy, evidence_scope: 'claims_typed_v1' },
      keys,
      key,
    ),
    typed,
  );
  assert.throws(
    () =>
      researchRequest({ ...legacy, evidence_scope: 'future_scope' }, keys, key),
    /Refresh/,
  );
});

test('retained claim research scopes keep automatic access and freshness checks', () => {
  assert.equal(hasClaimInputs('claims_v1'), true);
  assert.equal(hasClaimInputs('claims_typed_v1'), true);
  assert.equal(hasClaimInputs('saved'), false);
  assert.equal(hasClaimInputs(undefined), false);
  assert.equal(hasClaimInputs('future_scope'), false);
});
