import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-questions-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/question-library.ts',
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
const {
  firstQuestionPage,
  questionLibraryPath,
  questionPage,
  questionReads,
} = require(join(build, 'question-library.js'));
after(() => rmSync(build, { recursive: true, force: true }));

test('new question searches reset pages and forward only literal query and selected answer filter', () => {
  const selection = firstQuestionPage({
    query: '  GLP-1 50% A_B & renal  ',
    status: 'answered',
    offset: 120,
    privateContext: 'Do not forward',
    source_receipt: 'secret',
  });
  assert.deepEqual(selection, {
    query: 'GLP-1 50% A_B & renal',
    status: 'answered',
    offset: 0,
  });
  const url = new URL(
    questionLibraryPath('pharma', 'topic', selection),
    'https://product.test',
  );
  assert.equal(url.pathname, '/products/pharma/dossiers/topic/discussion');
  assert.equal(url.searchParams.get('q'), selection.query);
  assert.deepEqual([...url.searchParams.keys()], ['q', 'status', 'offset']);
  assert.equal(url.searchParams.get('status'), 'answered');
  assert.doesNotMatch(url.href, /secret|privateContext/);
  assert.deepEqual(
    firstQuestionPage({ query: '', status: 'all', offset: 60 }),
    { query: '', status: 'all', offset: 0 },
  );
});

test('question pages use the displayed search and filter, without applying unsent form edits', () => {
  const shown = {
    query: 'renal safety',
    status: 'open',
    offset: 30,
    page_size: 30,
  };
  const draft = { query: 'unsent new query', status: 'answered' };
  assert.deepEqual(questionPage(shown, 1), {
    query: 'renal safety',
    status: 'open',
    offset: 60,
  });
  assert.deepEqual(questionPage(shown, -1), {
    query: 'renal safety',
    status: 'open',
    offset: 0,
  });
  assert.equal(questionPage({ ...shown, offset: 0 }, -1).offset, 0);
  assert.deepEqual(questionPage({ ...shown, offset: 90 }, 0), {
    query: 'renal safety',
    status: 'open',
    offset: 0,
  });
  assert.deepEqual(draft, { query: 'unsent new query', status: 'answered' });
});

function pending() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
test('a late question read cannot reopen a view after leaving or replace a newer question', async () => {
  const reads = questionReads();
  const first = pending();
  const one = reads.read(() => first.promise);
  const two = reads.read(async () => ({ id: 'newer' }));
  assert.deepEqual(await two, { id: 'newer' });
  first.resolve({ id: 'old' });
  assert.equal(await one, null);
  const leaving = pending();
  const late = reads.read(() => leaving.promise);
  reads.cancel();
  leaving.resolve({ id: 'left' });
  assert.equal(await late, null);
});
test('stale failures are discarded and the current failed question can be retried exactly', async () => {
  const reads = questionReads();
  const first = pending();
  const old = reads.read(() => first.promise);
  reads.cancel();
  first.reject(new Error('old failure'));
  assert.equal(await old, null);
  const calls = [];
  const fetch = async () => {
    calls.push('/discussion/exact-question?offset=50');
    if (calls.length === 1) throw new Error('Retry this question');
    return { id: 'exact-question', replies: ['saved reply'] };
  };
  await assert.rejects(reads.read(fetch), /Retry this question/);
  assert.deepEqual(await reads.read(fetch), {
    id: 'exact-question',
    replies: ['saved reply'],
  });
  assert.deepEqual(calls, [
    '/discussion/exact-question?offset=50',
    '/discussion/exact-question?offset=50',
  ]);
});
