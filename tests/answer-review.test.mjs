import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-answer-review-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/answer-review.ts',
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
const { answerReviewRequest } = require(join(build, 'answer-review.js'));
after(() => rmSync(build, { recursive: true, force: true }));

const state = {
  revision: 5,
  accepted_entry_id: 'saved-note',
  answer_review: {
    fingerprint: 'a'.repeat(64),
    reasons: [{ message: 'Private source corrected' }],
  },
  accepted: { body: 'Private historic answer' },
};

test('reconfirmation binds the displayed evidence state without rewriting the saved answer', () => {
  const request = answerReviewRequest(state);
  assert.deepEqual(request, {
    expected_revision: 5,
    entry_id: 'saved-note',
    expected_review: 'a'.repeat(64),
  });
  assert.doesNotMatch(JSON.stringify(request), /Private|body|reasons/);
  assert.deepEqual(
    answerReviewRequest({
      ...state,
      accepted: { body: 'Browser edited text' },
    }),
    request,
  );
  assert.notDeepEqual(
    answerReviewRequest({
      ...state,
      answer_review: { fingerprint: 'b'.repeat(64) },
    }),
    request,
  );
});

test('missing or malformed review state cannot downgrade to an unchecked confirmation', () => {
  for (const changes of [
    { accepted_entry_id: null },
    { revision: 0 },
    { revision: 1.5 },
    { answer_review: undefined },
    { answer_review: { fingerprint: '' } },
    { answer_review: { fingerprint: 'a'.repeat(63) } },
  ]) {
    assert.throws(
      () => answerReviewRequest({ ...state, ...changes }),
      /Refresh/,
    );
  }
});
