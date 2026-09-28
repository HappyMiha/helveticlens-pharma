import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
const built = ts.transpileModule(
  readFileSync('lib/resource-reader.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
);
const compiled = new Module('resource-reader');
compiled._compile(built.outputText, 'resource-reader.cjs');
const { ResourceReader } = compiled.exports;
function fixture(url = '/saved/version?expected_revision=7') {
  const pending = [];
  const reader = new ResourceReader(
    url,
    (path, signal) =>
      new Promise((resolve, reject) =>
        pending.push({ path, signal, resolve, reject }),
      ),
  );
  reader.activate();
  return { reader, pending };
}
test('failed refresh removes prior contents; the error stays until a successful exact-page retry', async () => {
  const { reader, pending } = fixture();
  let done = reader.refresh();
  pending[0].resolve({ title: 'Private saved text' });
  await done;
  assert.equal(reader.snapshot().data.title, 'Private saved text');
  done = reader.refresh();
  assert.equal(reader.snapshot().refreshing, true);
  assert.equal(reader.snapshot().data.title, 'Private saved text');
  pending[1].reject(new Error('Access was withdrawn'));
  await done;
  assert.deepEqual(reader.snapshot(), {
    data: null,
    error: 'Access was withdrawn',
    loading: false,
    refreshing: false,
  });
  done = reader.refresh();
  assert.equal(reader.snapshot().data, null);
  assert.equal(reader.snapshot().error, 'Access was withdrawn');
  assert.equal(reader.snapshot().refreshing, true);
  pending[2].reject(new Error('Still unavailable'));
  await done;
  done = reader.refresh();
  pending[3].resolve({ title: 'Current permitted capture' });
  await done;
  assert.deepEqual(reader.snapshot(), {
    data: { title: 'Current permitted capture' },
    error: '',
    loading: false,
    refreshing: false,
  });
  assert.ok(
    pending.every((item) => item.path === '/saved/version?expected_revision=7'),
  );
});
test('a transport that ignores abort cannot replace a newer successful read', async () => {
  const { reader, pending } = fixture();
  const first = reader.refresh(),
    next = reader.refresh();
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ value: 'new' });
  await next;
  pending[0].resolve({ value: 'obsolete' });
  await first;
  assert.equal(reader.snapshot().data.value, 'new');
});
test('a late success cannot clear the current denial, and a late failure cannot replace a retry', async () => {
  const { reader, pending } = fixture();
  const first = reader.refresh(),
    denied = reader.refresh();
  pending[1].reject(new Error('Denied'));
  await denied;
  pending[0].resolve({ value: 'private old result' });
  await first;
  assert.equal(reader.snapshot().data, null);
  assert.equal(reader.snapshot().error, 'Denied');
  const stale = reader.refresh(),
    retry = reader.refresh();
  pending[3].resolve({ value: 'permitted' });
  await retry;
  pending[2].reject(new Error('Old error'));
  await stale;
  assert.equal(reader.snapshot().data.value, 'permitted');
  assert.equal(reader.snapshot().error, '');
});
test('navigation and unmount retire callbacks and abort only their own request', async () => {
  const old = fixture('/dossier/one'),
    current = fixture('/dossier/two');
  const lateRefresh = old.reader.refresh;
  const oldDone = old.reader.refresh(),
    currentDone = current.reader.refresh();
  old.reader.deactivate();
  assert.equal(old.pending[0].signal.aborted, true);
  await lateRefresh();
  assert.equal(old.pending.length, 1);
  assert.equal(current.pending[0].signal.aborted, false);
  current.pending[0].resolve({ value: 'two' });
  await currentDone;
  old.pending[0].resolve({ value: 'one' });
  await oldDone;
  assert.equal(old.reader.snapshot().data, null);
  assert.equal(current.reader.snapshot().data.value, 'two');
});
test('session reset removes retained data immediately and fences already running replies', async () => {
  const { reader, pending } = fixture();
  let done = reader.refresh();
  pending[0].resolve({ owner: 'previous user' });
  await done;
  const obsolete = reader.refresh();
  done = reader.reset();
  assert.equal(reader.snapshot().data, null);
  assert.equal(reader.snapshot().loading, true);
  assert.equal(pending[1].signal.aborted, true);
  pending[1].resolve({ owner: 'previous user' });
  await obsolete;
  assert.equal(reader.snapshot().data, null);
  pending[2].reject(new Error('Sign in'));
  await done;
  assert.equal(reader.snapshot().error, 'Sign in');
});
test('strict lifecycle reactivation cannot accept an earlier mount result', async () => {
  const { reader, pending } = fixture();
  const old = reader.refresh();
  reader.deactivate();
  reader.activate();
  const current = reader.refresh();
  pending[0].resolve({ value: 'old mount' });
  await old;
  assert.equal(reader.snapshot().data, null);
  pending[1].resolve({ value: 'current mount' });
  await current;
  assert.equal(reader.snapshot().data.value, 'current mount');
});
test('disabled readers never fetch and SSR snapshots remain stable and empty', async () => {
  const { reader, pending } = fixture(null);
  await reader.refresh();
  await reader.reset();
  assert.equal(pending.length, 0);
  assert.deepEqual(reader.snapshot(), {
    data: null,
    error: '',
    loading: false,
    refreshing: false,
  });
  const active = fixture();
  const initial = active.reader.serverSnapshot();
  const done = active.reader.refresh();
  active.pending[0].resolve({ private: true });
  await done;
  assert.strictEqual(active.reader.serverSnapshot(), initial);
  assert.equal(initial.data, null);
});
test('subscriptions see actual read progress, unsubscribe cleanly, and unexpected failures remain actionable', async () => {
  const reader = new ResourceReader('/evidence', async () => {
    throw null;
  });
  const events = [];
  const remove = reader.subscribe(() => events.push(reader.snapshot()));
  reader.activate();
  await reader.refresh();
  remove();
  await reader.refresh();
  assert.equal(events.length, 2);
  assert.equal(events[0].refreshing, true);
  assert.equal(events[1].refreshing, false);
  assert.equal(events[1].loading, false);
  assert.match(events[1].error, /retry/);
});
