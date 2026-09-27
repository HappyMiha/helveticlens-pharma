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

test('public catalogue and reader are bounded to this product', async () => {
  let called = 0;
  globalThis.fetch = async () => {
    called++;
    return Response.json({ items: [], total: 0 });
  };
  for (const route of [
    `products/${product.id}/public-dossiers`,
    `products/${product.id}/public-dossiers/11111111-1111-1111-1111-111111111111`,
  ]) {
    const result = await proxy(
      new Request('https://product.test/api/' + route),
      context(route),
    );
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
  }
  for (const route of [
    'products/other/public-dossiers',
    `products/${product.id}/public-dossiers/private/export`,
  ]) {
    assert.equal(
      (
        await proxy(
          new Request('https://product.test/api/' + route),
          context(route),
        )
      ).status,
      404,
    );
  }
  assert.equal(called, 2);
});

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
    `products/${product.id}/dossiers/topic/references`,
    `products/${product.id}/dossiers/topic/references/saved-source`,
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
  assert.equal(calls.length, 7);
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
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/dossiers/topic/references`,
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/dossiers/topic/references/saved-source`,
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
  assert.equal(calls.length, 7);
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

test('research preview and reviewed generation preserve private input identity within this product', async () => {
  const route = `products/${product.id}/dossiers/topic/discussion/question`;
  const expected = {
    expected_revision: 2,
    expected_evidence: 'a'.repeat(64),
    request_key: 'request-id',
  };
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return Response.json(
      init.method === 'GET'
        ? { input: { sources: ['private excerpt'] } }
        : { detail: 'Evidence changed; refresh the preview.' },
      { status: init.method === 'GET' ? 200 : 409 },
    );
  };
  const read = await proxy(
    new Request(`https://product.test/api/${route}/research-preview`, {
      headers: { cookie: 'helvetic_lens_session=test; unrelated=secret' },
    }),
    context(`${route}/research-preview`),
  );
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('cache-control'), 'private, no-store');
  const response = await proxy(
    new Request(`https://product.test/api/${route}/research`, {
      method: 'POST',
      headers: {
        origin: 'https://product.test',
        'content-type': 'application/json',
        'x-csrf-token': 'csrf',
      },
      body: JSON.stringify(expected),
    }),
    context(`${route}/research`),
  );
  assert.equal(response.status, 409);
  assert.match((await response.json()).detail, /Evidence changed/);
  assert.deepEqual(
    JSON.parse(new TextDecoder().decode(calls[1].init.body)),
    expected,
  );
  assert.equal(
    calls[0].init.headers.get('cookie'),
    'helvetic_lens_session=test',
  );
  assert.equal(calls[1].init.headers.get('x-csrf-token'), 'csrf');
  const other = product.id === 'pharma' ? 'loyer' : 'pharma';
  const denied = route.replace(`products/${product.id}/`, `products/${other}/`);
  assert.equal(
    (
      await proxy(
        new Request(`https://product.test/api/${denied}/research-preview`),
        context(`${denied}/research-preview`),
      )
    ).status,
    404,
  );
  assert.equal(calls.length, 2);
});

test('saved document readers retain scoped cursors, revision conflicts and private caching', async () => {
  const root = `products/${product.id}/dossiers/topic/documents/page/versions`;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return Response.json(
      { detail: 'Saved revision changed.' },
      { status: 409 },
    );
  };
  for (const [path, query] of [
    [root, '?cursor=cutoff%2B%2F%3D'],
    [`${root}/saved`, '?offset=16000&expected_revision=7'],
  ]) {
    const response = await proxy(
      new Request(`https://product.test/api/${path}${query}`, {
        headers: { cookie: 'helvetic_lens_session=private; unrelated=secret' },
      }),
      context(path),
    );
    assert.equal(response.status, 409);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match((await response.json()).detail, /revision changed/);
  }
  assert.equal(calls[0].url.searchParams.get('cursor'), 'cutoff+/=');
  assert.equal(calls[1].url.searchParams.get('expected_revision'), '7');
  assert.equal(calls[1].url.searchParams.get('offset'), '16000');
  assert.equal(
    calls[1].init.headers.get('cookie'),
    'helvetic_lens_session=private',
  );
  const other = product.id === 'pharma' ? 'loyer' : 'pharma';
  const denied = root.replace(`products/${product.id}/`, `products/${other}/`);
  assert.equal(
    (
      await proxy(
        new Request(`https://product.test/api/${denied}`),
        context(denied),
      )
    ).status,
    404,
  );
  assert.equal(calls.length, 2);
});

test('research source lookup stays private and cannot resolve through the other product', async () => {
  const route = `products/${product.id}/dossiers/topic/discussion/question/research/note/sources/S1/document`;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(new URL(url).pathname, `/api/${route}`);
    assert.equal(new URL(url).search, '');
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    assert.equal(init.headers.get('cookie'), 'helvetic_lens_session=member');
    return Response.json(
      { detail: 'The saved page is no longer accessible.' },
      { status: 404 },
    );
  };
  const response = await proxy(
    new Request(`https://product.test/api/${route}`, {
      headers: { cookie: 'helvetic_lens_session=member; unrelated=private' },
    }),
    context(route),
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match((await response.json()).detail, /no longer accessible/);
  const other = product.id === 'pharma' ? 'loyer' : 'pharma';
  const denied = route.replace(`products/${product.id}/`, `products/${other}/`);
  assert.equal(
    (
      await proxy(
        new Request(`https://product.test/api/${denied}`),
        context(denied),
      )
    ).status,
    404,
  );
  assert.equal(calls, 1);
});

test('answer reconfirmation preserves the reviewed-state fingerprint and stale conflict', async () => {
  const route = `products/${product.id}/dossiers/topic/discussion/question/accept`;
  const body = {
    expected_revision: 4,
    entry_id: 'note',
    expected_review: 'a'.repeat(64),
  };
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).pathname, `/api/${route}`);
    assert.equal(init.headers.get('x-csrf-token'), 'csrf');
    assert.deepEqual(JSON.parse(await new Response(init.body).text()), body);
    return Response.json(
      { detail: 'Evidence changed. Refresh the question before reconfirming.' },
      { status: 409 },
    );
  };
  const response = await proxy(
    new Request(`https://product.test/api/${route}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        origin: 'https://product.test',
        'content-type': 'application/json',
        'x-csrf-token': 'csrf',
      },
    }),
    context(route),
  );
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match((await response.json()).detail, /Refresh the question/);
});

test('private question search preserves literal query, answer filter, page and upstream error', async () => {
  const route = `products/${product.id}/dossiers/topic/discussion`;
  const params = new URLSearchParams({
    q: 'renal 50% A_B & safety',
    status: 'answered',
    offset: '60',
  });
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(new URL(url).pathname, `/api/${route}`);
    assert.equal(new URL(url).searchParams.get('q'), 'renal 50% A_B & safety');
    assert.equal(new URL(url).searchParams.get('status'), 'answered');
    assert.equal(new URL(url).searchParams.get('offset'), '60');
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    assert.equal(init.headers.get('cookie'), 'helvetic_lens_session=member');
    return Response.json(
      { detail: 'Use up to 12 distinct words to find questions.' },
      { status: 422 },
    );
  };
  const response = await proxy(
    new Request(`https://product.test/api/${route}?${params}`, {
      headers: { cookie: 'helvetic_lens_session=member; unrelated=private' },
    }),
    context(route),
  );
  assert.equal(response.status, 422);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match((await response.json()).detail, /12 distinct words/);
  const other = route.replace(
    `products/${product.id}/`,
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/`,
  );
  assert.equal(
    (
      await proxy(
        new Request(`https://product.test/api/${other}?${params}`),
        context(other),
      )
    ).status,
    404,
  );
  assert.equal(calls, 1);
});

test('public contribution actions retain consent, revision and CSRF with strict route isolation', async () => {
  const id = '11111111-1111-1111-1111-111111111111';
  const route = `products/${product.id}/public-dossiers/${id}/discussion`;
  const payload = {
    request_key: id,
    expected_revision: 2,
    action: 'hide',
    reason: 'Evidence reviewed',
  };
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(init.headers.get('x-csrf-token'), 'csrf');
    assert.equal(init.headers.get('cookie'), 'helvetic_lens_session=member');
    assert.deepEqual(JSON.parse(await new Response(init.body).text()), payload);
    return Response.json(
      {
        detail:
          'This contribution changed. Reload the discussion before saving.',
      },
      { status: 409 },
    );
  };
  for (const suffix of ['', `/${id}`, `/${id}/action`]) {
    const response = await proxy(
      new Request(`https://product.test/api/${route}${suffix}`, {
        method: 'POST',
        headers: {
          origin: 'https://product.test',
          'content-type': 'application/json',
          cookie: 'helvetic_lens_session=member; unrelated=secret',
          'x-csrf-token': 'csrf',
        },
        body: JSON.stringify(payload),
      }),
      context(route + suffix),
    );
    assert.equal(response.status, 409);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  const other = product.id === 'pharma' ? 'loyer' : 'pharma';
  for (const denied of [
    route.replace(product.id, other),
    route + '/admin',
    route + `/${id}/files`,
    route + '/workspace/extra',
  ]) {
    assert.equal(
      (
        await proxy(
          new Request('https://product.test/api/' + denied),
          context(denied),
        )
      ).status,
      404,
    );
  }
  assert.equal(
    (
      await proxy(
        new Request('https://product.test/api/' + route, {
          method: 'POST',
          headers: { origin: 'https://foreign.test' },
          body: '{}',
        }),
        context(route),
      )
    ).status,
    403,
  );
  assert.equal(calls, 3);
});

test('private discussion controls require the current native session', async () => {
  const path = `products/${product.id}/public-dossiers/11111111-1111-1111-1111-111111111111/discussion/workspace`;
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).searchParams.get('offset'), '20');
    assert.equal(init.headers.get('cookie'), null);
    return Response.json({ detail: 'Sign in to continue.' }, { status: 401 });
  };
  const response = await proxy(
    new Request('https://product.test/api/' + path + '?offset=20'),
    context(path),
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('personal following and reviewed reuse use only native product routes', async () => {
  let called = 0;
  globalThis.fetch = async (_url, init) => {
    called++;
    assert.equal(init.headers.get('x-csrf-token'), 'csrf');
    return Response.json({ ok: true });
  };
  const id = '11111111-1111-1111-1111-111111111111';
  for (const suffix of [
    'followed-dossiers',
    `public-dossiers/${id}/follow`,
    `public-dossiers/${id}/follow/read`,
    `public-dossiers/${id}/reuse`,
    `public-dossiers/${id}/reuse/preview`,
  ]) {
    const route = `products/${product.id}/${suffix}`;
    const response = await proxy(
      new Request('https://product.test/api/' + route, {
        headers: { 'x-csrf-token': 'csrf' },
      }),
      context(route),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  for (const suffix of [
    `public-dossiers/${id}/follow/export`,
    `public-dossiers/${id}/reuse/private`,
    'followed-dossiers/another-user',
  ]) {
    const route = `products/${product.id}/${suffix}`;
    assert.equal(
      (
        await proxy(
          new Request('https://product.test/api/' + route),
          context(route),
        )
      ).status,
      404,
    );
  }
  const route = `products/${product.id}/public-dossiers/${id}/reuse`;
  assert.equal(
    (
      await proxy(
        new Request('https://product.test/api/' + route, {
          method: 'POST',
          headers: { origin: 'https://other.test' },
          body: '{}',
        }),
        context(route),
      )
    ).status,
    403,
  );
  assert.equal(called, 5);
});

test('decision search gateway forwards exact public query and allows only bounded same-product routes', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const base = `products/${product.id}/discover`;
  const body = JSON.stringify({
    query: 'Public query',
    alternatives: ['Öffentliche Frage', 'Question publique'],
    mode: 'compare',
    public_query_confirmed: true,
  });
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(init.headers.get('authorization'), null);
    assert.equal(init.headers.get('x-csrf-token'), 'csrf');
    assert.equal(new TextDecoder().decode(init.body), body);
    assert.match(new URL(url).pathname, new RegExp(`^/api/${base}/`));
    return Response.json({ ok: true });
  };
  const request = () =>
    new Request('https://product.test/api/' + base, {
      method: 'POST',
      body,
      headers: {
        origin: 'https://product.test',
        'x-csrf-token': 'csrf',
        authorization: 'untrusted',
        'content-type': 'application/json',
      },
    });
  for (const suffix of [
    'engines',
    'expand',
    'decision',
    'runs',
    `runs/${id}`,
    `runs/${id}/labels`,
    `runs/${id}/inspect`,
  ]) {
    const response = await proxy(request(), context(`${base}/${suffix}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  for (const route of [
    `${base}/runs/${id}/delete`,
    `${base}/runs/${id}/inspect/extra`,
    `${base}/provider-key`,
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/discover/decision`,
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/discover/expand`,
  ])
    assert.equal((await proxy(request(), context(route))).status, 404);
  assert.equal(calls, 7);
});

test('investigation activity streams without buffering and forwards its reconnect cursor', async () => {
  let controller;
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers.get('last-event-id'), '12');
    assert.match(url, /investigations\/run\/events\?after=10$/);
    return new Response(
      new ReadableStream({
        start(value) {
          controller = value;
          value.enqueue(
            new TextEncoder().encode('id: 13\nevent: activity\ndata: {}\n\n'),
          );
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    );
  };
  const route = `products/${product.id}/dossiers/dossier/investigations/run/events`;
  const response = await proxy(
    new Request(`https://product.test/api/${route}?after=10`, {
      headers: { 'Last-Event-ID': '12', accept: 'text/event-stream' },
    }),
    context(route),
  );
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.equal(first.done, false);
  assert.match(new TextDecoder().decode(first.value), /id: 13/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  controller.close();
  assert.equal((await reader.read()).done, true);
});

test('dossier invitation gateway preserves account cookies and restricts product and action', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([url, init]);
    return Response.json({ dossier_id: id });
  };
  for (const suffix of ['', `/${id}/accept`]) {
    const route = `products/${product.id}/dossier-invitations${suffix}`;
    const result = await proxy(
      new Request(`https://product.test/api/${route}`, {
        method: suffix ? 'POST' : 'GET',
        headers: {
          cookie: 'helvetic_lens_session=fixture; unrelated=drop',
          'x-csrf-token': 'fixture',
          origin: 'https://product.test',
        },
        ...(suffix ? { body: '{}' } : {}),
      }),
      context(route),
    );
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(
    calls[1][1].headers.get('cookie'),
    'helvetic_lens_session=fixture',
  );
  assert.equal(calls[1][1].headers.get('x-csrf-token'), 'fixture');
  for (const route of [
    `products/${product.id === 'pharma' ? 'loyer' : 'pharma'}/dossier-invitations`,
    `products/${product.id}/dossier-invitations/${id}/promote`,
    `products/${product.id}/dossier-invitations/not-an-id/accept`,
  ]) {
    assert.equal(
      (
        await proxy(
          new Request(`https://product.test/api/${route}`),
          context(route),
        )
      ).status,
      404,
    );
  }
  assert.equal(calls.length, 2);
});
