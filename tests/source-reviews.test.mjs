import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-reviews-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/source-reviews.ts',
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
const { reviewDraft, reviewConflict, rebaseReview, reviewRequest } = require(
  join(build, 'source-reviews.js'),
);
after(() => rmSync(build, { recursive: true, force: true }));

test('new team history never silently rebases a review and explicit rebase retains the explanation', () => {
  const initial = { id: 'first', data: { decision: 'include' } };
  const latest = { id: 'second', data: { decision: 'exclude' } };
  const draft = {
    ...reviewDraft(initial, 'retry-key'),
    decision: 'unreviewed',
    reason: 'Still checking original evidence',
  };
  assert.equal(reviewConflict(draft, initial), false);
  assert.equal(reviewConflict(draft, latest), true);
  assert.equal(draft.expected_review_id, 'first');
  const rebased = rebaseReview(draft, latest, 'new-key');
  assert.equal(rebased.expected_review_id, 'second');
  assert.equal(rebased.decision, 'exclude');
  assert.equal(rebased.reason, draft.reason);
  assert.equal(rebased.request_key, 'new-key');
  assert.equal(reviewConflict(rebased, latest), false);
  assert.equal(draft.request_key, 'retry-key');
});

test('failed retries keep the original expected review and cannot send forged URL or provenance', () => {
  const draft = {
    ...reviewDraft(null, 'stable-key'),
    reason: '  Evidence remains uncertain  ',
    url: 'https://wrong.example',
    actor: 'someone',
    revision: 500,
  };
  const first = reviewRequest(draft);
  assert.deepEqual(first, {
    request_key: 'stable-key',
    expected_review_id: null,
    decision: 'unreviewed',
    reason: 'Evidence remains uncertain',
  });
  assert.deepEqual(reviewRequest(draft), first);
  assert.equal(
    reviewConflict(draft, {
      id: 'another-review',
      data: { decision: 'include' },
    }),
    true,
  );
});
