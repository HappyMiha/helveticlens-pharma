import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-pages-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/discovery-pages.ts',
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
const { discoveryPath, appendDiscoveryPage } = require(
  join(build, 'discovery-pages.js'),
);
after(() => rmSync(build, { recursive: true, force: true }));

test('continuation uses the displayed query and encodes opaque cursor without forwarding other data', () => {
  const result = {
    query: 'GLP-1 & safety + trial_a 50%',
    provider: 'europepmc',
    page_number: 1,
    items: [{ title: 'A result' }],
    purpose: 'Private team context',
    checked_at: 'yesterday',
  };
  const url = new URL(
    discoveryPath('pharma', result, 'opaque+mark/=='),
    'https://product.test',
  );
  assert.equal(url.searchParams.get('q'), result.query);
  assert.equal(url.searchParams.get('cursor'), 'opaque+mark/==');
  assert.deepEqual([...url.searchParams.keys()], ['provider', 'q', 'cursor']);
  assert.doesNotMatch(url.href, /Private|yesterday|result/);
  const workspace = new URL(
    discoveryPath(
      'legal',
      { ...result, provider: 'workspace', match_mode: 'phrase' },
      'unused',
    ),
    'https://product.test',
  );
  assert.equal(workspace.searchParams.get('mode'), 'phrase');
  assert.equal(workspace.searchParams.has('cursor'), false);
});

test('visited pages stay intact when a continuation changes query, provider or order', () => {
  const first = {
    query: 'safety',
    provider: 'europepmc',
    page_number: 1,
    items: [{ id: 'first' }],
  };
  const pages = [first];
  const second = { ...first, page_number: 2, items: [{ id: 'second' }] };
  const extended = appendDiscoveryPage(pages, second);
  assert.deepEqual(
    extended.map((page) => page.items[0].id),
    ['first', 'second'],
  );
  assert.deepEqual(pages, [first]);
  for (const changed of [
    { query: 'unsubmitted new query' },
    { provider: 'fedlex' },
    { page_number: 1 },
  ])
    assert.throws(
      () => appendDiscoveryPage(pages, { ...second, ...changed }),
      /displayed search/,
    );
  assert.deepEqual(pages, [first]);
});
