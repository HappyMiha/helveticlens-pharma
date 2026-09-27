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

test('AI planning forwards only the explicit same-product request with CSRF', async () => {
  let calls = 0;
  const body = JSON.stringify({ question: 'What medicine evidence changed?' });
  const route = `products/${product.id}/discover/plan`;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(new URL(url).pathname, `/api/${route}`);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.get('x-csrf-token'), 'csrf');
    assert.equal(new TextDecoder().decode(init.body), body);
    return Response.json({
      angles: [],
      question: 'What medicine evidence changed?',
    });
  };
  const request = () =>
    new Request(`https://product.test/api/${route}`, {
      method: 'POST',
      body,
      headers: {
        origin: 'https://product.test',
        'content-type': 'application/json',
        'x-csrf-token': 'csrf',
      },
    });
  const result = await proxy(request(), context(route));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  for (const forbidden of [
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/discover/plan`,
    `products/${product.id}/discover/unrestricted`,
    `${route}/extra`,
  ])
    assert.equal((await proxy(request(), context(forbidden))).status, 404);
  assert.equal(calls, 1);
});

test('research, private discussion and brief preserve query, authorization and response boundaries', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return new Response('private content', {
      headers: {
        'content-type': 'text/html',
        'content-security-policy':
          "default-src 'none'; style-src 'unsafe-inline'",
        'referrer-policy': 'no-referrer',
      },
    });
  };
  for (const route of [
    `products/${product.id}/discover`,
    `products/${product.id}/workbench`,
    `products/${product.id}/dossiers/topic/discussion/question`,
    `products/${product.id}/dossiers/topic/brief`,
    `products/${product.id}/dossiers/topic/searches`,
  ]) {
    const response = await proxy(
      new Request(
        `https://product.test/api/${route}?q=source%20evidence&cursor=opaque%2B%2F%3D`,
        {
          headers: { cookie: 'helvetic_lens_session=test; unrelated=secret' },
        },
      ),
      context(route),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(
      response.headers.get('content-security-policy'),
      /default-src 'none'/,
    );
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  }
  assert.equal(calls.length, 5);
  for (const { url, init } of calls) {
    assert.equal(url.origin, 'https://helveticlens.ch');
    assert.equal(url.searchParams.get('q'), 'source evidence');
    assert.equal(url.searchParams.get('cursor'), 'opaque+/=');
    assert.equal(init.headers.get('cookie'), 'helvetic_lens_session=test');
  }
  for (const route of [
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/discover`,
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/workbench`,
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/dossiers/topic/searches`,
  ])
    assert.equal(
      (
        await proxy(
          new Request(`https://product.test/api/${route}`),
          context(route),
        )
      ).status,
      404,
    );
  assert.equal(calls.length, 5);
});

test('discovery imports preserve the exact signed body and CSRF only within this product', async () => {
  const body = JSON.stringify({
    request_key: 'stable-retry',
    receipt: 'signed+source/==',
  });
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(
      new URL(url).pathname,
      `/api/products/${product.id}/dossiers/topic/discovery-references`,
    );
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.get('x-csrf-token'), 'csrf');
    assert.equal(await new Response(init.body).text(), body);
    return Response.json({ id: 'reference' }, { status: 201 });
  };
  for (const candidate of [
    product.id,
    product.id === 'pharma' ? 'loyer' : 'pharma',
  ]) {
    const route = `products/${candidate}/dossiers/topic/discovery-references`;
    const response = await proxy(
      new Request(`https://product.test/api/${route}`, {
        method: 'POST',
        body,
        headers: {
          origin: 'https://product.test',
          'content-type': 'application/json',
          'x-csrf-token': 'csrf',
        },
      }),
      context(route),
    );
    assert.equal(response.status, candidate === product.id ? 201 : 404);
  }
  assert.equal(calls, 1);
});

test('source review conflicts preserve the explanation and exact revision through the private gateway', async () => {
  const route = `products/${product.id}/dossiers/topic/sources/reference/reviews`;
  const input = {
    request_key: 'same-request',
    expected_review_id: 'previous-review',
    decision: 'exclude',
    reason: 'Not relevant to this question',
  };
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).pathname, `/api/${route}`);
    assert.equal(init.headers.get('x-csrf-token'), 'csrf');
    assert.deepEqual(JSON.parse(await new Response(init.body).text()), input);
    return Response.json(
      { detail: 'The team reviewed this URL while you were working.' },
      { status: 409 },
    );
  };
  const response = await proxy(
    new Request(`https://product.test/api/${route}`, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        origin: 'https://product.test',
        'content-type': 'application/json',
        'x-csrf-token': 'csrf',
      },
    }),
    context(route),
  );
  assert.equal(response.status, 409);
  assert.match((await response.json()).detail, /while you were working/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
