import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Mount real Workspace navigation and transport. Independent panels are probes;
// the setup probe keeps a draft so unintended replacement is observable.
const require = createRequire(import.meta.url);
const originalResolve = Module._resolveFilename,
  originalLoad = Module._load;
const extensions = new Map(
  ['.ts', '.tsx'].map((ext) => [ext, Module._extensions[ext]]),
);
const globals = new Map(
  ['fetch', 'window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
    key,
    globalThis[key],
  ]),
);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.document = { cookie: '' };
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(
    this,
    name.startsWith('@/') ? resolve(name.slice(2)) : name,
    ...args,
  );
};
for (const ext of extensions.keys())
  Module._extensions[ext] = (module, filename) => {
    module._compile(
      ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
        fileName: filename,
      }).outputText,
      filename,
    );
  };
const wrap = ({ children }) => React.createElement('div', null, children);
const Empty = () => null;
const ResearchDesk = () => null;
const FeedsWorkspace = () => null;
const Dossier = () => null;
const AuthDialog = () => null;
function Wizard() {
  const [draft, setDraft] = React.useState('');
  return React.createElement('input', {
    'aria-label': 'Setup draft',
    value: draft,
    onChange: (event) => setDraft(event.target.value),
  });
}
Module._load = function (name, parent, ...args) {
  if (name === 'lucide-react') return new Proxy({}, { get: () => Empty });
  if (name === 'next/link') return { __esModule: true, default: wrap };
  if (name.includes('/ui/'))
    return new Proxy(
      {},
      {
        get: (_target, key) =>
          ({ Button: 'button', Input: 'input', Checkbox: 'input' })[key] ||
          wrap,
      },
    );
  if (
    parent?.filename === resolve('components/workspace.tsx') &&
    name.startsWith('./')
  ) {
    if (name === './research-desk') return { ResearchDesk };
    if (name === './feeds') return { FeedsWorkspace };
    if (name === './dossier') return { Dossier };
    if (name === './wizard') return { Wizard };
    if (name === './auth-dialog') return { AuthDialog };
    if (name === './app-shell')
      return { AppShell: wrap, GlassSidebar: wrap, TopNavigation: wrap };
    return new Proxy({}, { get: () => Empty });
  }
  return originalLoad.call(this, name, parent, ...args);
};
after(() => {
  Module._load = originalLoad;
  Module._resolveFilename = originalResolve;
  for (const [ext, value] of extensions) {
    if (value) Module._extensions[ext] = value;
    else delete Module._extensions[ext];
  }
  for (const [key, value] of globals) globalThis[key] = value;
});
const Workspace = require(resolve('components/workspace.tsx')).default;
const response = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
const dossier = (id) => ({
  id,
  access: { can_edit: true },
  profile: { config: { name: id }, status: 'draft' },
});
function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function mounted({ admin = true, initialSearch = '' } = {}) {
  const handlers = new Map(),
    requests = [],
    reads = [];
  const location = { search: initialSearch };
  globalThis.window = {
    location,
    history: {
      pushState(_state, _title, url) {
        location.search = new URL(url, 'https://example.test').search;
      },
    },
    addEventListener(name, callback) {
      handlers.set(name, callback);
    },
    removeEventListener(name) {
      handlers.delete(name);
    },
  };
  globalThis.fetch = async (url, init) => {
    assert.equal(init.method, 'GET', 'This journey performs reads only');
    requests.push(url);
    if (url === '/api/auth/session')
      return response({
        authenticated: true,
        role: admin ? 'organization_admin' : 'viewer',
        user: { id: 'owner', name: 'Owner' },
        organization: { id: 'workspace', name: 'Workspace' },
      });
    if (url.endsWith('/source-packs')) return response({ items: [] });
    if (url.endsWith('/monitoring-profiles'))
      return response({ email_available: false });
    if (url.endsWith('/dossiers')) return response({ items: [], total: 0 });
    const request = deferred();
    reads.push({ ...request, url });
    return request.promise;
  };
  let tree;
  await act(async () => {
    tree = create(React.createElement(Workspace));
  });
  return {
    tree,
    reads,
    requests,
    location,
    desk: () => tree.root.findByType(ResearchDesk),
    feeds: () => tree.root.findByType(FeedsWorkspace),
    popView(search) {
      location.search = search;
      handlers.get('popstate')();
    },
    wizard: () => tree.root.findByType(Wizard),
    current: () => tree.root.findByType(Dossier),
    pop(id) {
      location.search = `?dossier=${id}`;
      handlers.get('popstate')();
    },
    close: async () => {
      await act(async () => tree.unmount());
    },
  };
}

for (const fails of [false, true])
  test(`starting a dossier keeps the new form after an older open ${fails ? 'fails' : 'succeeds'}`, async () => {
    const h = await mounted();
    let opening;
    try {
      await act(async () => {
        opening = h.desk().props.onOpen('older');
      });
      await act(async () => {
        h.desk().props.onStart({ name: 'New work', goal: 'A new question' });
      });
      await act(async () => {
        h.tree.root
          .findByProps({ 'aria-label': 'Setup draft' })
          .props.onChange({ target: { value: 'Keep this question' } });
      });
      await act(async () => {
        h.reads[0].resolve(
          fails
            ? response({ detail: 'Old read failed' }, 503)
            : response(dossier('older')),
        );
        await opening;
      });
      assert.equal(h.wizard().props.initial, null);
      assert.equal(
        h.tree.root.findByProps({ 'aria-label': 'Setup draft' }).props.value,
        'Keep this question',
      );
      assert.equal(h.tree.root.findAllByType(Dossier).length, 0);
      assert.equal(h.location.search, '?view=new');
    } finally {
      await h.close();
    }
  });

test('entering current dossier setup supersedes an earlier history navigation', async () => {
  const h = await mounted();
  let opening;
  try {
    await act(async () => {
      opening = h.desk().props.onOpen('current');
    });
    await act(async () => {
      h.reads[0].resolve(response(dossier('current')));
      await opening;
    });
    assert.equal(h.current().props.dossier.id, 'current');
    await act(async () => {
      h.pop('earlier');
    });
    await act(async () => {
      h.current().props.onSetup();
    });
    await act(async () => {
      h.reads[1].resolve(response(dossier('earlier')));
    });
    assert.equal(h.wizard().props.initial.id, 'current');
    assert.equal(h.tree.root.findAllByType(Dossier).length, 0);
    assert.equal(h.location.search, '?dossier=current');
  } finally {
    await h.close();
  }
});

test('a denied creation attempt does not invalidate an authorized dossier read', async () => {
  const h = await mounted({ admin: false });
  let opening;
  try {
    await act(async () => {
      opening = h.desk().props.onOpen('readable');
    });
    await act(async () => {
      h.desk().props.onStart();
    });
    assert.equal(h.tree.root.findAllByType(Wizard).length, 0);
    await act(async () => {
      h.reads[0].resolve(response(dossier('readable')));
      await opening;
    });
    assert.equal(h.current().props.dossier.id, 'readable');
  } finally {
    await h.close();
  }
});

test('feeds are an internal sidebar workspace with deep links and browser-history selection', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const h = await mounted({ initialSearch: `?view=feeds&feed=${id}` });
  try {
    assert.equal(h.feeds().props.selectedId, id);
    await act(async () => h.feeds().props.onSelect(null));
    assert.equal(h.location.search, '?view=feeds');
    await act(async () => h.feeds().props.onSelect(id));
    assert.equal(h.location.search, `?view=feeds&feed=${id}`);
    await act(async () => h.popView('?view=feeds'));
    assert.equal(h.feeds().props.selectedId, null);
    const sidebar = h.tree.root.findByProps({
      'aria-label': 'Workspace navigation',
    });
    const nav = sidebar
      .findAllByType('button')
      .find((node) => node.children.includes('Feeds'));
    assert.match(nav.props.className, /nav-active/);
    assert.equal(
      h.requests.some((url) => url.includes('/feeds')),
      false,
      'the workspace delegates feed reads to its authorized panel',
    );
  } finally {
    await h.close();
  }
});
