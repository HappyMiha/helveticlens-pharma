import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const build = mkdtempSync(join(tmpdir(), 'helveticlens-watch-'));
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  'lib/page-watch.ts',
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
const { pageWatchStatus } = require(join(build, 'page-watch.js'));
after(() => rmSync(build, { recursive: true, force: true }));
const watch = {
  active: true,
  auto_check_enabled: true,
  last_result: 'unchanged',
  last_success_at: '2026-09-26T23:00:00Z',
  schedule: 'scheduled',
  stale: false,
};

test('a failed attempt remains a warning despite retained successful evidence', () => {
  const status = pageWatchStatus({ ...watch, last_result: 'failed' });
  assert.equal(status.tone, 'warning');
  assert.equal(status.label, 'Last attempt failed');
  assert.equal(status.canCheck, true);
});
test('missing history, synthetic content and old successful checks cannot appear healthy', () => {
  for (const values of [
    { last_success_at: null },
    { synthetic: true },
    { stale: true },
    { schedule: 'needs_operator' },
    { schedule: 'unscheduled' },
  ]) {
    assert.equal(pageWatchStatus({ ...watch, ...values }).tone, 'warning');
  }
  assert.equal(pageWatchStatus(watch).tone, 'good');
});
test('paused or already queued native watches cannot admit another check from the card', () => {
  assert.equal(pageWatchStatus({ ...watch, active: false }).canCheck, false);
  const queued = pageWatchStatus({
    ...watch,
    active_scan: { status: 'queued', stage: 'queued' },
  });
  assert.equal(queued.canCheck, false);
  assert.equal(queued.label, 'Check queued');
  assert.equal(
    pageWatchStatus({ ...watch, auto_check_enabled: false, schedule: 'manual' })
      .canCheck,
    true,
  );
});
