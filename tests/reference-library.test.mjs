import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-library-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/reference-library.ts',
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
const { firstReferencePage, referenceLibraryPath, referencePage } = require(
  join(build, 'reference-library.js'),
);
after(() => rmSync(build, { recursive: true, force: true }));

test('new source searches reset pages and forward only literal query and selected review filter', () => {
  const selection = firstReferencePage({
    query: '  GLP-1 50% A_B & renal  ',
    decision: 'exclude',
    offset: 120,
    privateContext: 'Do not forward',
    source_receipt: 'secret',
  });
  assert.deepEqual(selection, {
    query: 'GLP-1 50% A_B & renal',
    decision: 'exclude',
    offset: 0,
  });
  const url = new URL(
    referenceLibraryPath('pharma', 'topic', selection),
    'https://product.test',
  );
  assert.equal(url.pathname, '/products/pharma/dossiers/topic/references');
  assert.equal(url.searchParams.get('q'), selection.query);
  assert.deepEqual([...url.searchParams.keys()], ['q', 'decision', 'offset']);
  assert.equal(url.searchParams.get('decision'), 'exclude');
  assert.doesNotMatch(url.href, /secret|privateContext/);
  assert.deepEqual(
    firstReferencePage({ query: '', decision: 'all', offset: 60 }),
    { query: '', decision: 'all', offset: 0 },
  );
});

test('source pages use the displayed search and filter, without applying unsent form edits', () => {
  const shown = {
    query: 'renal safety',
    decision: 'include',
    offset: 30,
    page_size: 30,
  };
  const draft = { query: 'unsent new query', decision: 'exclude' };
  assert.deepEqual(referencePage(shown, 1), {
    query: 'renal safety',
    decision: 'include',
    offset: 60,
  });
  assert.deepEqual(referencePage(shown, -1), {
    query: 'renal safety',
    decision: 'include',
    offset: 0,
  });
  assert.equal(referencePage({ ...shown, offset: 0 }, -1).offset, 0);
  assert.deepEqual(referencePage({ ...shown, offset: 90 }, 0), {
    query: 'renal safety',
    decision: 'include',
    offset: 0,
  });
  assert.deepEqual(draft, { query: 'unsent new query', decision: 'exclude' });
});
