import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-search-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/search-recipes.ts',
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
const { recipeFromResult, recipeLabel } = require(
  join(build, 'search-recipes.js'),
);
after(() => rmSync(build, { recursive: true, force: true }));

test('saved queries retain the displayed literal query and mode without result or execution claims', () => {
  const recipe = recipeFromResult({
    query: 'trial_a 50% safety',
    provider: 'workspace',
    match_mode: 'phrase',
    items: [{ title: 'Private result' }],
    total: 1,
    checked_at: '2026-09-27T00:00:00Z',
  });
  assert.deepEqual(recipe, {
    query: 'trial_a 50% safety',
    provider: 'workspace',
    match_mode: 'phrase',
  });
  assert.match(recipeLabel(recipe), /Exact phrase/);
});

test('public searches cannot inherit a workspace match mode or expose their result records', () => {
  for (const provider of ['fedlex', 'europepmc']) {
    const recipe = recipeFromResult({
      query: 'safety evidence',
      provider,
      match_mode: 'all',
      items: [{ id: 'result' }],
    });
    assert.deepEqual(recipe, {
      query: 'safety evidence',
      provider,
      match_mode: null,
    });
    assert.doesNotMatch(recipeLabel(recipe), /All words|Exact phrase/);
  }
});
