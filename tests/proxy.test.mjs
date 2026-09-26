import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-proxy-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/proxy.ts',
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
const require = createRequire(import.meta.url);
const { proxy } = require(join(build, 'proxy.js'));
const { product } = require(join(build, 'product.js'));
const actualFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = actualFetch;
  rmSync(build, { recursive: true, force: true });
});
function context(path) {
  return { params: Promise.resolve({ path: path.split('/') }) };
}

test('forwards only platform cookies and preserves session cookie separation', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).origin, 'https://helveticlens.ch');
    assert.equal(
      init.headers.get('cookie'),
      'helvetic_lens_session=opaque; helvetic_lens_csrf=csrf',
    );
    assert.equal(init.headers.get('authorization'), null);
    return new Response('{"authenticated":true}', {
      headers: [
        ['content-type', 'application/json'],
        ['set-cookie', 'helvetic_lens_session=new; HttpOnly; Secure'],
        ['set-cookie', 'helvetic_lens_csrf=newcsrf; Secure'],
      ],
    });
  };
  const result = await proxy(
    new Request('https://product.test/api/auth/session', {
      headers: {
        cookie:
          'sites_private=do-not-forward; helvetic_lens_session=opaque; helvetic_lens_csrf=csrf',
        authorization: 'do-not-forward',
      },
    }),
    context('auth/session'),
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers.getSetCookie().length, 2);
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
});
test('blocks cross-origin writes, admin routes and the other product before forwarding', async () => {
  globalThis.fetch = () => {
    throw new Error('must not forward');
  };
  assert.equal(
    (
      await proxy(
        new Request('https://product.test/api/auth/login', {
          method: 'POST',
          headers: { origin: 'https://other.test' },
          body: '{}',
        }),
        context('auth/login'),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await proxy(
        new Request('https://product.test/api/admin/settings'),
        context('admin/settings'),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await proxy(
        new Request('https://product.test/api/products/x/dossiers'),
        context(
          `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/dossiers`,
        ),
      )
    ).status,
    404,
  );
});
test('caps chunked uploads even without a content-length header', async () => {
  globalThis.fetch = () => {
    throw new Error('must not forward');
  };
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(12 * 1024 * 1024));
      controller.close();
    },
  });
  const request = new Request('https://product.test/api/upload', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  });
  assert.equal(
    (
      await proxy(
        request,
        context(`products/${product.id}/dossiers/test/files`),
      )
    ).status,
    413,
  );
});
test('forwards binary attachments with a private download disposition', async () => {
  globalThis.fetch = async () =>
    new Response(new Uint8Array([0, 1, 2, 255]), {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': 'attachment; filename="evidence.bin"',
      },
    });
  const result = await proxy(
    new Request('https://product.test/api/file'),
    context(`products/${product.id}/dossiers/test/files/example`),
  );
  assert.deepEqual(
    [...new Uint8Array(await result.arrayBuffer())],
    [0, 1, 2, 255],
  );
  assert.match(result.headers.get('content-disposition'), /attachment/);
});
test('upstream failure is visible and does not expose network details', async () => {
  globalThis.fetch = async () => {
    throw new Error('private diagnostic');
  };
  const response = await proxy(
    new Request('https://product.test/api/auth/session'),
    context('auth/session'),
  );
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private diagnostic/);
});
