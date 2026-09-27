'use client';
import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from './field';
import { PublicSnapshot } from './public-origin';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { dossierHref } from '@/lib/dossier-navigation';
import type { PublicDossier } from '@/lib/publication';
import type { ReusePreview } from '@/lib/public-following';
import { reuseDraft, reuseCommand } from '@/lib/public-following';

export function PublicReuse({
  dossier,
  workspaceName,
}: {
  dossier: PublicDossier;
  workspaceName: string;
}) {
  const formId = useId();
  const previewPanel = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(() => reuseDraft(dossier));
  const [preview, setPreview] = useState<ReusePreview | null>(null),
    [requestKey, setRequestKey] = useState('');
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const path = `/products/${product.id}/public-dossiers/${dossier.id}/reuse`;
  async function prepare() {
    setBusy(true);
    setError('');
    setPreview(null);
    setConfirmed(false);
    try {
      setPreview(await api<ReusePreview>(path + '/preview', draft));
      setRequestKey(uid());
      requestAnimationFrame(() => previewPanel.current?.focus());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!preview || !confirmed) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ dossier_id: string }>(
        path,
        reuseCommand(preview, requestKey, confirmed),
      );
      setSaved(result.dossier_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(key: 'name' | 'goal', value: string) {
    setDraft({ ...draft, [key]: value });
    setPreview(null);
    setConfirmed(false);
    setError('');
  }
  return (
    <details className="public-reuse">
      <summary>
        <Copy size={16} />
        Create a private working copy
      </summary>
      {saved ? (
        <div className="public-empty">
          <output>Your private draft is ready</output>
          <p>Continue the setup to choose topics, sources and delivery.</p>
          <Link href={dossierHref({ id: saved })}>
            Open private draft <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (preview ? create() : prepare());
          }}
        >
          <p>
            Start an author-private draft in <strong>{workspaceName}</strong>.
            The reviewed public text, attribution and source links are retained.
            Public discussion and private workspace material are not part of the
            copy.
          </p>
          <Field label="Name your private dossier">
            <Input
              value={draft.name}
              required
              minLength={3}
              maxLength={160}
              disabled={busy}
              onChange={(e) => update('name', e.target.value)}
            />
          </Field>
          <Field label="What do you want to monitor?">
            <Textarea
              value={draft.goal}
              required
              minLength={10}
              maxLength={3000}
              rows={3}
              disabled={busy}
              onChange={(e) => update('goal', e.target.value)}
            />
          </Field>
          {error && (
            <p className="banner error" role="alert">
              {error}
            </p>
          )}
          {preview && (
            <div
              className="reuse-preview"
              ref={previewPanel}
              tabIndex={-1}
              aria-label="Exact private copy preview"
            >
              <h3>Review the exact copy</h3>
              <p>
                <strong>{preview.draft.name}</strong>
              </p>
              <p>{preview.draft.goal}</p>
              <PublicSnapshot snapshot={preview.snapshot} />
              <p>
                <a
                  href={preview.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Original public dossier
                </a>{' '}
                · Revision {preview.snapshot.revision}
              </p>
              <p>
                The saved snapshot is independent: it remains available in your
                dossier if the original changes or is withdrawn. Linked
                documents are not downloaded; their source rights still apply.
              </p>
              <p>
                Monitoring starts after you complete the setup. The draft
                delivery choice is off; confirm it or choose another option
                during setup. This action does not publish the copy or follow
                the original.
              </p>
              <p className="public-meta">
                Preview expires {date(preview.preview_expires_at)} (30 minutes
                after preparation).
              </p>
              <label className="reuse-consent" htmlFor={`${formId}-consent`}>
                <Checkbox
                  id={`${formId}-consent`}
                  checked={confirmed}
                  disabled={busy}
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                />
                <span>
                  Create a private draft from this reviewed public version.
                </span>
              </label>
            </div>
          )}
          <div className="public-action-row">
            <Button type="submit" disabled={busy || (!!preview && !confirmed)}>
              {busy
                ? 'Saving…'
                : preview
                  ? 'Create private draft'
                  : 'Preview private copy'}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void prepare()}
              >
                Refresh preview
              </Button>
            )}
          </div>
        </form>
      )}
    </details>
  );
}
