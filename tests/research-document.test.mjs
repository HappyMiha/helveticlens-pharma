import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-research-document-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/research-document.ts',
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
const { previewDocument, researchDocumentPath, researchDocumentPage } = require(
  join(build, 'research-document.js'),
);
after(() => rmSync(build, { recursive: true, force: true }));

const source = {
  kind: 'saved_page_extract',
  id: 'S1',
  key: 'saved-version',
  document_id: 'connected-page',
  evidence_revision: 7,
  text: 'Private source text',
  url: 'https://external.example/private',
};

test('a preview opens only a complete recorded page identity without forwarding source text', () => {
  const target = previewDocument(source);
  assert.deepEqual(target, {
    document_id: 'connected-page',
    version_id: 'saved-version',
    expected_revision: 7,
    revision_recorded: true,
  });
  assert.deepEqual(researchDocumentPage(target), {
    id: 'saved-version',
    offset: 0,
    revision: 7,
  });
  assert.doesNotMatch(
    JSON.stringify(target),
    /Private|external|source text|url/,
  );
  for (const changes of [
    { kind: 'official_event_metadata' },
    { kind: 'team_contribution' },
    { document_id: '' },
    { document_id: '../elsewhere' },
    { evidence_revision: 0 },
    { evidence_revision: 1.5 },
    { evidence_revision: true },
    { evidence_revision: undefined },
  ]) {
    assert.equal(previewDocument({ ...source, ...changes }), null);
  }
});

test('saved-note lookup identifies the note and source rather than sending an editable document target', () => {
  const path = researchDocumentPath(
    '/products/pharma/dossiers/topic',
    'question',
    'note',
    'S1',
  );
  assert.equal(
    path,
    '/products/pharma/dossiers/topic/discussion/question/research/note/sources/S1/document',
  );
  assert.doesNotMatch(path, /saved-version|connected-page|external|Private/);
  const escaped = researchDocumentPath(
    '/topic',
    'question?x=1',
    'note/other',
    'S1#fragment',
  );
  assert.equal(
    escaped,
    '/topic/discussion/question%3Fx%3D1/research/note%2Fother/sources/S1%23fragment/document',
  );
});

test('only an explicit legacy response may open without a captured revision', () => {
  const legacy = {
    document_id: 'page',
    version_id: 'version',
    revision_recorded: false,
    expected_revision: null,
  };
  assert.deepEqual(researchDocumentPage(legacy), { id: 'version', offset: 0 });
  for (const changes of [
    { revision_recorded: undefined },
    { revision_recorded: true },
    { expected_revision: 3 },
    { expected_revision: undefined },
    { version_id: '../other' },
  ]) {
    assert.throws(
      () => researchDocumentPage({ ...legacy, ...changes }),
      /could not be verified/,
    );
  }
  assert.throws(
    () =>
      researchDocumentPage({
        ...legacy,
        revision_recorded: true,
        expected_revision: 2147483648,
      }),
    /could not be verified/,
  );
});
