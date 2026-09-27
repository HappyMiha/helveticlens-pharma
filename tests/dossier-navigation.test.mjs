import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-navigation-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/dossier-navigation.ts',
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
  dossierHref,
  readDossierLink,
  discoveryTarget,
  recordDossierNavigation,
  referencePath,
} = require(join(build, 'dossier-navigation.js'));
after(() => rmSync(build, { recursive: true, force: true }));

test('saved source URLs contain only escaped identifiers and preserve the target after reload or login', () => {
  const target = {
    id: 'topic & question=other',
    referenceId: 'record/#? ü',
    questionId: 'ignored',
    title: 'private title',
    query: 'private research',
    receipt: 'private receipt',
  };
  const href = dossierHref(target);
  const url = new URL(href, 'https://product.test');
  assert.deepEqual([...url.searchParams.keys()], ['dossier', 'source']);
  assert.equal(url.hash, '');
  assert.deepEqual(readDossierLink(url.search), {
    id: target.id,
    referenceId: target.referenceId,
    questionId: null,
  });
  assert.doesNotMatch(href, /private|ignored/);
  assert.equal(readDossierLink('?source=orphan'), null);
  const path = referencePath('pharma', target.id, target.referenceId);
  const segments = path.split('/');
  assert.equal(segments.length, 7);
  assert.equal(decodeURIComponent(segments[4]), target.id);
  assert.equal(decodeURIComponent(segments[6]), target.referenceId);
});

test('workspace results preserve exact sources, question replies and ordinary topic destinations', () => {
  const hit = {
    id: 'saved-reference',
    dossier_id: 'topic',
    kind: 'reference',
    thread_id: 'unrelated',
  };
  assert.deepEqual(discoveryTarget(hit), {
    id: 'topic',
    referenceId: 'saved-reference',
    questionId: null,
  });
  for (const kind of ['question', 'discussion', 'review']) {
    const target = discoveryTarget({ ...hit, kind, thread_id: 'question' });
    assert.equal(dossierHref(target), '/?dossier=topic&question=question');
    assert.deepEqual(readDossierLink(dossierHref(target).slice(1)), {
      id: 'topic',
      questionId: 'question',
      referenceId: null,
    });
  }
  assert.equal(
    dossierHref(discoveryTarget({ ...hit, kind: 'note', thread_id: null })),
    '/?dossier=topic',
  );
  assert.equal(
    discoveryTarget({
      id: 'external',
      kind: 'reference',
      url: 'https://source.test',
    }),
    null,
  );
});

test('history replay and refresh never push a second entry or truncate forward navigation', () => {
  const paths = ['/?view=research'];
  let position = 0;
  const history = {
    pushState(_state, _unused, url) {
      paths.splice(position + 1);
      paths.push(url);
      position++;
    },
  };
  const source = { id: 'topic', referenceId: 'saved-source' };
  recordDossierNavigation(history, source, true);
  const question = { id: 'topic', questionId: 'question' };
  recordDossierNavigation(history, question, true);
  position--;
  const replay = readDossierLink(
    new URL(paths[position], 'https://product.test').search,
  );
  recordDossierNavigation(history, replay, false);
  recordDossierNavigation(history, replay, false);
  assert.equal(paths.length, 3);
  assert.equal(paths[++position], '/?dossier=topic&question=question');
  recordDossierNavigation(history, { id: 'topic' }, true);
  assert.equal(paths[position], '/?dossier=topic');
});
