import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const build = mkdtempSync(join(tmpdir(), 'helveticlens-publication-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/publication.ts',
  'lib/public-reader.ts',
  'lib/product.ts',
  '--outDir',
  build,
  '--target',
  'es2022',
  '--module',
  'commonjs',
  '--skipLibCheck',
  '--esModuleInterop',
]);
symlinkSync(resolve('node_modules'), join(build, 'node_modules'), 'dir');
const require = createRequire(import.meta.url);
const { publicContent, publicOffset, publicSearch } = require(
  join(build, 'publication.js'),
);
const { readPublicDossier, readPublicPage, readPublicDiscussion } = require(
  join(build, 'public-reader.js'),
);
const actualFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = actualFetch;
  rmSync(build, { recursive: true, force: true });
});

test('new publication starts empty and copies only the reviewed public fields', () => {
  assert.deepEqual(publicContent(null), {
    title: '',
    summary: '',
    body: '',
    author_label: '',
    sources: [],
  });
  const copy = publicContent({
    title: 'Public title',
    summary: 'Public summary',
    body: 'Public body',
    author_label: 'Editor',
    sources: [
      {
        title: 'Official record',
        url: 'https://example.ch',
        private_receipt: 'secret',
      },
    ],
    organization_id: 'private',
    files: ['private'],
    context: { client: 'private' },
  });
  assert.equal(JSON.stringify(copy).includes('private'), false);
  assert.equal(JSON.stringify(copy).includes('secret'), false);
});

test('public navigation bounds offsets and preserves literal queries', () => {
  for (const value of ['-1', '1.5', '100001', 'Infinity', ['20'], undefined])
    assert.equal(publicOffset(value), 0);
  assert.equal(publicOffset('20'), 20);
  const link = new URL(
    publicSearch('100% alpha & beta', 20),
    'https://example.ch',
  );
  assert.equal(link.searchParams.get('q'), '100% alpha & beta');
  assert.equal(link.searchParams.get('offset'), '20');
});

test('server reader fetches only public records without credentials or persistent caching', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).origin, 'https://helveticlens.ch');
    assert.match(
      new URL(url).pathname,
      /^\/api\/products\/(pharma|loyer)\/public-dossiers/,
    );
    assert.deepEqual(init.headers, { accept: 'application/json' });
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'manual');
    return Response.json({ items: [], total: 0 });
  };
  assert.equal((await readPublicPage('research', 0)).data.total, 0);
});

test('public reader distinguishes missing publication from failed platform and rejects route injection', async () => {
  globalThis.fetch = async () => new Response('', { status: 404 });
  assert.equal(
    (await readPublicDossier('11111111-1111-1111-1111-111111111111')).missing,
    true,
  );
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  const failed = await readPublicPage('', 0);
  assert.equal(failed.missing, false);
  assert.equal(failed.data, undefined);
  globalThis.fetch = () => {
    assert.fail('invalid path must not be fetched');
  };
  assert.equal((await readPublicDossier('../dossiers/private')).missing, true);
});

test('an upstream redirect remains an unavailable response and is never followed', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(init.redirect, 'manual');
    return new Response('', {
      status: 302,
      headers: { location: 'https://unrelated.example/private' },
    });
  };
  const result = await readPublicPage('', 0);
  assert.equal(result.data, undefined);
  assert.equal(result.missing, false);
  assert.ok(result.error);
});

test('server discussion renders only an anonymous public projection', async () => {
  globalThis.fetch = async (url, init) => {
    assert.match(
      new URL(url).pathname,
      /\/public-dossiers\/[0-9a-f-]{36}\/discussion$/,
    );
    assert.deepEqual(init.headers, { accept: 'application/json' });
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'manual');
    return Response.json({ items: [], total: 0, can_post: false });
  };
  const result = await readPublicDiscussion(
    '11111111-1111-1111-1111-111111111111',
  );
  assert.equal(result.data.can_post, false);
  globalThis.fetch = () => {
    assert.fail('invalid path must not be fetched');
  };
  assert.equal(
    (await readPublicDiscussion('../private/workspace')).missing,
    true,
  );
});
