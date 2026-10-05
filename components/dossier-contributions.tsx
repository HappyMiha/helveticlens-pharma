'use client';
import { useRef, useState } from 'react';
import { FilePlus2, ArrowDownToLine } from 'lucide-react';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { readable } from '@/lib/investigation';
import { sourceReference } from '@/lib/source-reading';
import type { ContributionOriginal } from '@/lib/investigation';
import type { Entry } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export const CONTRIBUTION_DISCLOSURE =
  'Your original and authorship are retained. The workspace AI analyses your contribution privately. A submitted URL may be opened anonymously; private text is never used for public web searches. Nothing is published automatically.';
const kinds = [
  ['note', 'Comment'],
  ['reference', 'Source URL'],
  ['file', 'File'],
  ['correction', 'Correction'],
  ['research_request', 'Research request'],
] as const;

export function OriginalContribution({
  original,
  dossierId,
}: {
  original: ContributionOriginal;
  dossierId: string;
}) {
  const reference = sourceReference(original.url);
  const safeIds = [original.id, dossierId].every((id) =>
    /^[0-9a-f-]{36}$/.test(id),
  );
  return (
    <details className="contribution-original">
      <summary>Original contribution · {original.author}</summary>
      <p>
        {readable(original.kind)} ·{' '}
        <time dateTime={original.created_at}>{date(original.created_at)}</time>
      </p>
      {original.title && <h4>{original.title}</h4>}
      {original.body && <blockquote>{original.body}</blockquote>}
      {reference ? (
        <div>
          <p>
            <a
              className="break-all"
              href={reference.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              Submitted source URL · {reference.href}
            </a>
          </p>
          <p className="investigation-muted">
            Opens the current webpage. Research reading status and saved
            passages are shown separately.
          </p>
        </div>
      ) : original.url ? (
        <p className="investigation-muted">
          The submitted source URL cannot be opened here.
        </p>
      ) : null}
      {original.kind === 'file' && safeIds && (
        <a
          href={`/api/products/${product.id}/dossiers/${dossierId}/files/${original.id}`}
        >
          <ArrowDownToLine size={16} /> Download original ·{' '}
          {original.byte_size.toLocaleString()} bytes
        </a>
      )}
      {original.sha256 && <code>Original SHA-256 {original.sha256}</code>}
    </details>
  );
}

export function DossierContributions({
  dossierId,
  entries,
  canEdit,
  onOpen,
  onSaved,
}: {
  dossierId: string;
  entries: Entry[];
  canEdit: boolean;
  onOpen: (id: string) => void;
  onSaved: (entry: Entry) => Promise<void>;
}) {
  const [kind, setKind] = useState<string>('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInput, setFileInput] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef<{ fingerprint: string; request_key: string } | null>(
    null,
  );
  const recent = entries.filter((entry) => entry.analysis).slice(0, 6);
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    let saved = false;
    try {
      if (
        kind === 'file' &&
        (!file || !file.size || file.size > 100 * 1024 * 1024)
      )
        throw new Error('Choose a non-empty file of at most 100 MB.');
      const digest =
        kind === 'file' && file
          ? Array.from(
              new Uint8Array(
                await crypto.subtle.digest('SHA-256', await file.arrayBuffer()),
              ),
              (byte) => byte.toString(16).padStart(2, '0'),
            ).join('')
          : '';
      const fingerprint = JSON.stringify(
        kind === 'file'
          ? [kind, file?.name, file?.type, digest]
          : [kind, title, body, kind === 'reference' ? url : ''],
      );
      if (!pending.current || pending.current.fingerprint !== fingerprint)
        pending.current = { fingerprint, request_key: uid() };
      const base = `/products/${product.id}/dossiers/${dossierId}`;
      let entry: Entry;
      if (kind === 'file' && file) {
        const form = new FormData();
        form.append('file', file);
        form.append('request_key', pending.current.request_key);
        form.append('analyse', 'true');
        entry = await api<Entry>(`${base}/files`, form);
      } else {
        entry = await api<Entry>(`${base}/entries`, {
          request_key: pending.current.request_key,
          kind,
          title,
          body,
          url: kind === 'reference' ? url : '',
          analyse: true,
        });
      }
      saved = true;
      pending.current = null;
      setTitle('');
      setBody('');
      setUrl('');
      setFile(null);
      setFileInput((value) => value + 1);
      setNotice(
        'Original saved. Its private review is queued; progress and any unavailable steps appear below.',
      );
      if (entry.analysis) onOpen(entry.analysis.id);
      await onSaved(entry);
    } catch (failure) {
      if (saved)
        setNotice(
          'Original and review saved. Refresh the dossier to update the contribution list.',
        );
      else
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not confirm saving. Retry the same contribution safely.',
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="dossier-contributions"
      aria-labelledby={`contribute-${dossierId}`}
    >
      <div className="contribution-heading">
        <FilePlus2 size={20} />
        <h2 id={`contribute-${dossierId}`}>Add material for AI review</h2>
      </div>
      {canEdit ? (
        <form onSubmit={(event) => void save(event)}>
          <fieldset disabled={busy}>
            <legend className="sr-only">
              Add material to the investigation
            </legend>
            <div className="contribution-fields">
              <label htmlFor={`contribution-kind-${dossierId}`}>
                Contribution type
                <select
                  id={`contribution-kind-${dossierId}`}
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                >
                  {kinds.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {kind !== 'file' && (
                <label htmlFor={`contribution-title-${dossierId}`}>
                  Title <span className="investigation-muted">(optional)</span>
                  <Input
                    id={`contribution-title-${dossierId}`}
                    value={title}
                    maxLength={240}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
              )}
            </div>
            {kind === 'file' ? (
              <label htmlFor={`contribution-file-${dossierId}`}>
                Original file
                <Input
                  id={`contribution-file-${dossierId}`}
                  key={fileInput}
                  type="file"
                  required
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <small>
                  Save up to 100 MB. Automatic reading: TXT, Markdown, CSV, HTML
                  PDF, DOCX, XLSX, PPTX, JSON and email (.eml) up to 100 MB.
                  Scanned PDFs use local OCR for up to four pages. Check
                  quotations against the original when layout or recognition
                  matters.
                </small>
              </label>
            ) : (
              <>
                {kind === 'reference' && (
                  <label htmlFor={`contribution-url-${dossierId}`}>
                    Original source URL
                    <Input
                      id={`contribution-url-${dossierId}`}
                      type="url"
                      required
                      pattern="https://.*"
                      value={url}
                      maxLength={2000}
                      placeholder="https://…"
                      onChange={(event) => setUrl(event.target.value)}
                    />
                  </label>
                )}
                <label htmlFor={`contribution-body-${dossierId}`}>
                  {kind === 'correction'
                    ? 'What should be checked or corrected?'
                    : kind === 'research_request'
                      ? 'What should be investigated in the saved evidence?'
                      : kind === 'reference'
                        ? 'Context (optional)'
                        : 'Comment'}
                  <Textarea
                    id={`contribution-body-${dossierId}`}
                    required={kind !== 'reference'}
                    value={body}
                    maxLength={10000}
                    rows={3}
                    onChange={(event) => setBody(event.target.value)}
                  />
                </label>
              </>
            )}
            <p
              id={`contribution-privacy-${dossierId}`}
              className="investigation-muted"
            >
              {CONTRIBUTION_DISCLOSURE}
            </p>
            <Button
              type="submit"
              aria-describedby={`contribution-privacy-${dossierId}`}
            >
              {busy ? 'Saving original…' : 'Add & analyse'}
            </Button>
          </fieldset>
        </form>
      ) : (
        <p className="investigation-muted">
          An owner, editor or contributor can add material for private analysis.
        </p>
      )}
      {error && (
        <p role="alert" className="investigation-error">
          {error} Your input is retained for retry.
        </p>
      )}
      {notice && <output aria-live="polite">{notice}</output>}
      {!!recent.length && (
        <details className="contribution-recent">
          <summary>Recent contributions · {recent.length}</summary>
          <ul>
            {recent.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.title || readable(entry.kind)}</strong>
                  <small>
                    {entry.author} · {date(entry.created_at)}
                  </small>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => onOpen(entry.analysis!.id)}
                >
                  Open review
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
