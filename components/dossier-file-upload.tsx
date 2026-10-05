'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { api, uid } from '@/lib/api';
import { product } from '@/lib/product';
import type { Run } from '@/lib/contracts';
import { Button } from './ui/button';

type Selection = { file: File; requestKey: string };

/** A failed upload retains the same file and request identity for an explicit retry. */
export function DossierFileUpload({
  dossierId,
  busy,
  run,
  reload,
  notify,
}: {
  dossierId: string;
  busy: string;
  run: Run;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [inputVersion, setInputVersion] = useState(0);
  const uploading = useRef(false);

  function upload(next: Selection) {
    if (uploading.current || busy) return;
    uploading.current = true;
    void run('Uploading attachment', async () => {
      if (!next.file.size || next.file.size > 10 * 1024 * 1024)
        throw new Error('Choose a non-empty file of at most 10 MB.');
      const form = new FormData();
      form.append('file', next.file);
      form.append('request_key', next.requestKey);
      await api(`/products/${product.id}/dossiers/${dossierId}/files`, form);
      setSelection(null);
      setInputVersion((value) => value + 1);
      notify('File saved to the dossier.');
      try {
        await reload();
      } catch {
        throw new Error(
          'Your file was saved, but the dossier could not be refreshed. Reopen the dossier to see it.',
        );
      }
    }).finally(() => {
      uploading.current = false;
    });
  }

  return (
    <div className="upload-zone">
      <Upload size={30} />
      <h3>Attach evidence or working documents</h3>
      <p>
        Save-only attachment. For automatic analysis, open AI research → Submit
        material for AI review. Maximum 50 files per dossier.
      </p>
      <input
        key={inputVersion}
        aria-label="Upload a dossier file"
        type="file"
        disabled={!!busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file || uploading.current || busy) return;
          const next = { file, requestKey: uid() };
          setSelection(next);
          upload(next);
        }}
      />
      {selection && (
        <div>
          <p className="source-meta">Selected: {selection.file.name}</p>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => upload(selection)}
          >
            Retry attachment
          </Button>
        </div>
      )}
    </div>
  );
}
