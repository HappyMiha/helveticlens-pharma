import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-document-history-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/document-history.ts',
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
  historyPath,
  olderHistory,
  newerHistory,
  snapshotPath,
  adjacentSnapshot,
} = require(join(build, 'document-history.js'));
after(() => rmSync(build, { recursive: true, force: true }));

test('history backtracking keeps the captured first-page cutoff and opaque cursor intact', () => {
  const initial = { cursor: '', previous: [] };
  const second = olderHistory(initial, {
    first_cursor: 'cutoff+/=',
    next_cursor: 'older+/=',
  });
  const third = olderHistory(second, {
    first_cursor: 'different-cutoff',
    next_cursor: 'oldest',
  });
  assert.deepEqual(newerHistory(third), second);
  assert.deepEqual(newerHistory(second), { cursor: 'cutoff+/=', previous: [] });
  assert.equal(newerHistory(initial), null);
  assert.equal(olderHistory(third, { next_cursor: null }), null);
  const url = new URL(
    historyPath('https://product.test/versions', second.cursor),
  );
  assert.equal(url.searchParams.get('cursor'), 'older+/=');
  assert.equal(historyPath('/versions', ''), '/versions');
  assert.deepEqual(initial, { cursor: '', previous: [] });
});

test('text paging uses server Unicode offsets and pins the exact evidence revision', () => {
  const data = {
    id: 'version-id',
    evidence_revision: 7,
    plain_text: '👀'.repeat(16000),
    title: 'Private title',
    document: { name: 'Private document' },
    pagination: { next_offset: 16000, previous_offset: 0 },
  };
  const next = adjacentSnapshot(data, 'next');
  assert.deepEqual(next, { id: 'version-id', offset: 16000, revision: 7 });
  assert.equal(adjacentSnapshot(data, 'previous').offset, 0);
  const url = new URL(snapshotPath('https://product.test/versions', next));
  assert.equal(url.searchParams.get('offset'), '16000');
  assert.equal(url.searchParams.get('expected_revision'), '7');
  assert.doesNotMatch(url.href, /Private|title|plain_text|document/);
  assert.equal(
    adjacentSnapshot({ ...data, pagination: { next_offset: null } }, 'next'),
    null,
  );
  assert.equal(
    new URL(
      snapshotPath('https://product.test/versions', { id: data.id, offset: 0 }),
    ).searchParams.has('expected_revision'),
    false,
  );
});

test('malformed continuation cannot silently adopt another snapshot revision', () => {
  for (const [offset, revision] of [
    [-1, 1],
    [1.5, 1],
    [1, 0],
    [1, undefined],
    [NaN, 1],
  ]) {
    assert.throws(
      () =>
        adjacentSnapshot(
          {
            id: 'version',
            evidence_revision: revision,
            pagination: { next_offset: offset },
          },
          'next',
        ),
      /Reload/,
    );
  }
});
