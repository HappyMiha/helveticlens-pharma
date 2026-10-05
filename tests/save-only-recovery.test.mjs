import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Mount the actual dossier and file composer. Independent network panels and UI
// wrappers are inert; submissions, draft state and API transport remain real.
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
globalThis.window = { location: { search: '' } };
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
const EmptyPanel = () => null;
const wrap = ({ children }) => React.createElement('div', null, children);
const panels = new Proxy({}, { get: () => EmptyPanel });
Module._load = function (name, parent, ...args) {
  if (name === '@/hooks/use-mobile') return { useIsMobile: () => false };
  if (name === 'lucide-react') return panels;
  if (name.includes('/ui/')) {
    const tags = {
      Button: 'button',
      Input: 'input',
      Textarea: 'textarea',
      NativeSelect: 'select',
      NativeSelectOption: 'option',
    };
    return new Proxy({}, { get: (_target, key) => tags[key] || wrap });
  }
  if (
    parent?.filename === resolve('components/dossier.tsx') &&
    (name.startsWith('./') || name.startsWith('@/components/')) &&
    name !== './dossier-file-upload'
  ) {
    if (name === './workspace')
      return {
        ROOT: '/products/legal/dossiers',
        Empty: wrap,
        Field: wrap,
        Status: EmptyPanel,
      };
    return panels;
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
const { Dossier } = require(resolve('components/dossier.tsx'));
const { DossierFileUpload } = require(
  resolve('components/dossier-file-upload.tsx'),
);
const response = (value = { id: 'saved-entry' }) =>
  new Response(JSON.stringify(value), { status: 201 });
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
const text = (tree) => JSON.stringify(tree.toJSON());
const note = (tree) =>
  tree.root
    .findAllByType('textarea')
    .find((field) =>
      field.props.placeholder?.startsWith('What should the team'),
    );
const change = (field, value) => field.props.onChange({ target: { value } });
const submit = (form) => form.props.onSubmit({ preventDefault() {} });
const noteForm = (tree) => tree.root.findByProps({ className: 'note-form' });
const referenceForm = (tree) =>
  tree.root
    .findAllByType('form')
    .find((form) =>
      form.findAllByType('input').some((input) => input.props.type === 'url'),
    );
const fileInput = (tree) =>
  tree.root.findByProps({ 'aria-label': 'Upload a dossier file' });
const retry = (tree) =>
  tree.root
    .findAllByType('button')
    .find((button) => button.props.children === 'Retry attachment');
async function mounted({
  fileOnly = false,
  reload = async () => {},
  post = async () => response(),
} = {}) {
  const errors = [],
    notices = [],
    requests = [];
  globalThis.fetch = async (url, init) => {
    if (init.method === 'GET') return response([]);
    const body =
      init.body instanceof FormData ? init.body : JSON.parse(init.body);
    requests.push({ url, body });
    return post(body);
  };
  const props = {
    dossierId: 'dossier-a',
    userId: 'owner',
    canEdit: true,
    busy: '',
    reload,
    notify: (value) => notices.push(value),
    onBack() {},
    onSetup() {},
    run: async (_label, work) => {
      try {
        await work();
      } catch (error) {
        errors.push(error.message);
      }
    },
    dossier: {
      id: 'dossier-a',
      profile: {
        config: { name: 'Fictional research', goal: 'A question' },
        topic_ids: [],
        status: 'draft',
      },
      entries: [],
      documents: [],
      work: { revision: 1 },
      access: { audience: 'team' },
    },
  };
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(fileOnly ? DossierFileUpload : Dossier, props),
    );
  });
  return {
    tree,
    errors,
    notices,
    requests,
    close: async () => {
      await act(async () => tree.unmount());
    },
  };
}

test('an interrupted note response retries the same write identity without automatic replay', async () => {
  let calls = 0;
  const h = await mounted({
    post: async () => {
      if (++calls === 1) throw Error('response lost');
      return response();
    },
  });
  try {
    await act(async () => {
      change(note(h.tree), 'A retained observation');
    });
    await act(async () => {
      submit(noteForm(h.tree));
    });
    assert.equal(h.requests.length, 1);
    assert.equal(note(h.tree).props.value, 'A retained observation');
    await act(async () => {
      submit(noteForm(h.tree));
    });
    assert.equal(h.requests.length, 2);
    assert.equal(
      h.requests[0].body.request_key,
      h.requests[1].body.request_key,
    );
    assert.equal(note(h.tree).props.value, '');
    assert.equal(h.requests[0].body.analyse, undefined);
  } finally {
    await h.close();
  }
});

test('an acknowledged note clears before refresh failure and reports that it was saved', async () => {
  const h = await mounted({
    reload: async () => {
      throw Error('read failed');
    },
  });
  try {
    await act(async () => {
      change(note(h.tree), 'Already saved');
    });
    await act(async () => {
      submit(noteForm(h.tree));
    });
    assert.equal(note(h.tree).props.value, '');
    assert.match(h.errors[0], /contribution was saved.*could not be refreshed/);
    assert.equal(h.requests.length, 1);
    // Restoring the same draft after the refresh failure only retries the read.
    await act(async () => {
      change(note(h.tree), 'Already saved');
    });
    await act(async () => {
      submit(noteForm(h.tree));
    });
    assert.equal(h.requests.length, 1);
  } finally {
    await h.close();
  }
});

test('a newer note draft survives acknowledgement of the earlier submitted text', async () => {
  const slow = deferred();
  const h = await mounted({ post: () => slow.promise });
  try {
    await act(async () => {
      change(note(h.tree), 'Submitted note');
    });
    await act(async () => {
      submit(noteForm(h.tree));
    });
    await act(async () => {
      change(note(h.tree), 'New unsent note');
    });
    await act(async () => {
      slow.resolve(response());
    });
    assert.equal(h.requests[0].body.body, 'Submitted note');
    assert.equal(note(h.tree).props.value, 'New unsent note');
  } finally {
    await h.close();
  }
});

test('changed source reference drafts survive an older save and have distinct request identities', async () => {
  const slow = deferred();
  let calls = 0;
  const h = await mounted({
    post: () => (++calls === 1 ? slow.promise : Promise.resolve(response())),
  });
  const fields = () => referenceForm(h.tree).findAllByType('input');
  try {
    await act(async () => {
      change(fields()[0], 'Original source');
    });
    await act(async () => {
      change(fields()[1], 'https://example.org/first');
    });
    await act(async () => {
      submit(referenceForm(h.tree));
    });
    await act(async () => {
      change(fields()[0], 'A newer source');
    });
    await act(async () => {
      slow.resolve(response());
    });
    assert.equal(fields()[0].props.value, 'A newer source');
    await act(async () => {
      submit(referenceForm(h.tree));
    });
    assert.notEqual(
      h.requests[0].body.request_key,
      h.requests[1].body.request_key,
    );
    assert.equal(h.requests[1].body.title, 'A newer source');
    assert.equal(fields()[0].props.value, '');
  } finally {
    await h.close();
  }
});

test('an interrupted attachment keeps the file and repeats its key only on explicit retry', async () => {
  let calls = 0;
  const h = await mounted({
    fileOnly: true,
    post: async () => {
      if (++calls === 1) throw Error('response lost');
      return response();
    },
  });
  try {
    const file = new File(['retained private evidence'], 'evidence.txt', {
      type: 'text/plain',
    });
    await act(async () => {
      fileInput(h.tree).props.onChange({ target: { files: [file] } });
    });
    assert.equal(h.requests.length, 1);
    assert.ok(text(h.tree).includes('evidence.txt'));
    assert.ok(retry(h.tree));
    await act(async () => {
      retry(h.tree).props.onClick();
    });
    assert.equal(h.requests.length, 2);
    assert.equal(
      h.requests[0].body.get('request_key'),
      h.requests[1].body.get('request_key'),
    );
    assert.equal(
      await h.requests[1].body.get('file').text(),
      'retained private evidence',
    );
    assert.equal(h.requests[1].body.get('file').name, 'evidence.txt');
    assert.equal(h.requests[1].body.get('file').type, 'text/plain');
    assert.equal(h.requests[1].body.get('analyse'), null);
    assert.equal(retry(h.tree), undefined);
  } finally {
    await h.close();
  }
});

test('a saved attachment with failed refresh is acknowledged and no upload retry remains', async () => {
  const h = await mounted({
    fileOnly: true,
    reload: async () => {
      throw Error('read failed');
    },
  });
  try {
    await act(async () => {
      fileInput(h.tree).props.onChange({
        target: { files: [new File(['evidence'], 'saved.txt')] },
      });
    });
    assert.equal(h.requests.length, 1);
    assert.match(h.errors[0], /file was saved.*could not be refreshed/);
    assert.equal(h.notices[0], 'File saved to the dossier.');
    assert.equal(retry(h.tree), undefined);
  } finally {
    await h.close();
  }
});

test('empty attachment validation retains selection without sending a write', async () => {
  const h = await mounted({ fileOnly: true });
  try {
    await act(async () => {
      fileInput(h.tree).props.onChange({
        target: { files: [new File([], 'empty.txt')] },
      });
    });
    assert.equal(h.requests.length, 0);
    assert.match(h.errors[0], /non-empty file/);
    assert.ok(text(h.tree).includes('empty.txt'));
  } finally {
    await h.close();
  }
});
