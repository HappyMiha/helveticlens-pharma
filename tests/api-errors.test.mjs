import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
const compiled = new Module('api-errors');
compiled._compile(
  ts.transpileModule(readFileSync('lib/api.ts', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  'api-errors.cjs',
);
const { api, ApiError } = compiled.exports;
const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
after(() => {
  globalThis.fetch = originalFetch;
  globalThis.document = originalDocument;
});

test('HTML gateway failures become actionable errors with their real status and no retries', async () => {
  for (const status of [500, 502, 503, 504, 520, 530]) {
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      return new Response('<html>provider diagnostics</html>', { status });
    };
    await assert.rejects(api('/saved'), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.match(error.message, /temporarily unavailable.*loading again/);
      assert.doesNotMatch(error.message, /<html>|provider diagnostics/);
      return true;
    });
    assert.equal(requests, 1);
  }
});

test('non-JSON sign-in, permission, missing record and throttling failures stay distinct', async () => {
  for (const [status, message] of [
    [401, /Sign in again/],
    [403, /no longer have access/],
    [404, /could not be found/],
    [408, /timed out/],
    [429, /Wait a moment/],
  ]) {
    globalThis.fetch = async () => new Response('', { status });
    await assert.rejects(
      api('/saved'),
      (error) => error.status === status && message.test(error.message),
    );
  }
});

test('native permission and validation detail remains available without losing status', async () => {
  for (const [status, detail, expected] of [
    [403, 'Dossier membership required', 'Dossier membership required'],
    [
      422,
      [{ msg: 'Question is required' }, { msg: 'Invalid mode' }],
      'Question is required; Invalid mode',
    ],
    [409, 'This revision changed', 'This revision changed'],
  ]) {
    globalThis.fetch = async () => Response.json({ detail }, { status });
    await assert.rejects(
      api('/saved'),
      (error) => error.status === status && error.message === expected,
    );
  }
});

test('interrupted actions are never replayed and retain CSRF and request identity', async () => {
  globalThis.document = { cookie: 'helvetic_lens_csrf=fixture-token' };
  const body = { request_key: 'fixture-request', question: 'Public question' };
  for (const failure of ['http', 'network']) {
    let requests = 0;
    globalThis.fetch = async (url, init) => {
      requests++;
      assert.equal(url, '/api/research');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['X-CSRF-Token'], 'fixture-token');
      assert.deepEqual(JSON.parse(init.body), body);
      if (failure === 'network') throw new TypeError('fetch failed');
      return Response.json({ detail: 'Internal diagnostics' }, { status: 503 });
    };
    await assert.rejects(
      api('/research', body),
      /Check the saved status before repeating this action/,
    );
    assert.equal(requests, 1);
  }
});

test('network failure has a connection message and cancellation retains AbortError', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(
    api('/saved'),
    (error) =>
      error.status === null && /Check your connection/.test(error.message),
  );
  const abort = new DOMException('Cancelled', 'AbortError');
  globalThis.fetch = async () => {
    throw abort;
  };
  await assert.rejects(api('/saved'), (error) => error === abort);
});

test('a malformed successful response is an error, not an empty saved dossier', async () => {
  globalThis.fetch = async () =>
    new Response('<html>login or proxy page</html>', { status: 200 });
  await assert.rejects(api('/saved'), /unreadable response/);
});

test('valid success and explicitly empty responses retain their existing values', async () => {
  globalThis.fetch = async () => Response.json({ items: [], total: 0 });
  assert.deepEqual(await api('/saved'), { items: [], total: 0 });
  globalThis.fetch = async () => Response.json(null);
  assert.equal(await api('/saved'), null);
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await api('/saved'), null);
});
