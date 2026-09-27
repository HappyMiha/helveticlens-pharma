import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-origin-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/discovery-reference.ts',
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
const { sourceImport } = require(join(build, 'discovery-reference.js'));
after(() => rmSync(build, { recursive: true, force: true }));

test('imports only the server receipt and preserves retry identity independently of edited display metadata', () => {
  const keys = new Map();
  let generated = 0;
  const makeKey = () => `request-${++generated}`;
  const hit = {
    id: 'MED:321',
    discovery_receipt: 'signed-retrieval-one',
    title: 'Forged title',
    url: 'https://example.test/',
    query: 'Not the real query',
  };
  const first = sourceImport(hit, keys, makeKey);
  assert.deepEqual(first, {
    request_key: 'request-1',
    receipt: 'signed-retrieval-one',
  });
  assert.deepEqual(
    sourceImport({ ...hit, title: 'Changed' }, keys, makeKey),
    first,
  );
  assert.deepEqual(
    sourceImport(
      { ...hit, discovery_receipt: 'new-retrieval-same-record' },
      keys,
      makeKey,
    ),
    { request_key: 'request-2', receipt: 'new-retrieval-same-record' },
  );
  assert.equal(generated, 2);
});

test('missing, oversized and workspace records never fall back to unverified manual import', () => {
  const keys = new Map();
  let generated = 0;
  for (const hit of [
    {},
    { discovery_receipt: '' },
    { discovery_receipt: 'x'.repeat(24577) },
    { discovery_receipt: 'signed', dossier_id: 'private' },
  ])
    assert.throws(
      () => sourceImport(hit, keys, () => String(++generated)),
      /search again/,
    );
  assert.equal(generated, 0);
  assert.equal(keys.size, 0);
});
