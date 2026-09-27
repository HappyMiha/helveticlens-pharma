'use client';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { PublicContentView } from '@/components/public-content';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import { publicContent, publicHref } from '@/lib/publication';
import type {
  PublicContent,
  Publication,
  PublicationPreview,
  PublicationState,
} from '@/lib/publication';
import '@/app/public-dossiers/public.css';

export function PublicationEditor({
  dossierId,
  canEdit,
}: {
  dossierId: string;
  canEdit: boolean;
}) {
  const path = `/products/${product.id}/dossiers/${dossierId}/publication`;
  const { data, error, loading, refresh } = useResource<PublicationState>(path);
  const [notice, setNotice] = useState('');
  return (
    <section
      className="publication-editor"
      aria-label="Public dossier publication"
    >
      <h2>Public version</h2>
      <p>
        Prepare the text and source links you want everyone to read. Your
        workspace files, settings and discussions stay private.
      </p>
      <p>
        <a href="/public-dossiers" target="_blank" rel="noreferrer">
          Browse public dossiers
        </a>
      </p>
      {notice && <output>{notice}</output>}
      {loading && <output>Loading publication…</output>}
      {error ? (
        <div role="alert" className="banner error">
          {error}
          <Button variant="outline" onClick={() => void refresh()}>
            Retry loading
          </Button>
        </div>
      ) : (
        data && (
          <>
            {data.publication ? (
              <p>
                <b>
                  {data.publication.status === 'published'
                    ? 'Public'
                    : 'Withdrawn'}
                </b>{' '}
                · Revision {data.publication.revision} ·{' '}
                {date(data.publication.updated_at)}
                {data.publication.status === 'published' && (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={publicHref(
                        data.publication.slug || data.publication.id,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read public version
                    </a>
                  </>
                )}
              </p>
            ) : (
              <p>No public version has been published.</p>
            )}
            {canEdit ? (
              <PublicationForm
                key={`${dossierId}:${data.publication?.revision || 0}`}
                path={path}
                publication={data.publication}
                onSaved={async (publication) => {
                  setNotice(
                    publication.status === 'published'
                      ? 'The reviewed version is now public.'
                      : 'The public version has been withdrawn.',
                  );
                  await refresh();
                }}
                onReload={refresh}
              />
            ) : (
              <p>
                A workspace administrator can prepare and publish a version.
              </p>
            )}
            {data.history.length > 0 && (
              <details className="publication-history">
                <summary>
                  Publication history · latest {data.history.length}
                </summary>
                <ol>
                  {data.history.map((item) => (
                    <li key={item.revision}>
                      Revision {item.revision} ·{' '}
                      {item.action === 'publish'
                        ? 'Published with author confirmation'
                        : 'Withdrawn'}{' '}
                      · {date(item.created_at)}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </>
        )
      )}
    </section>
  );
}

function PublicationForm({
  path,
  publication,
  onSaved,
  onReload,
}: {
  path: string;
  publication: Publication | null;
  onSaved: (p: Publication) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const formId = useId();
  const [content, setContent] = useState<PublicContent>(() =>
    publicContent(publication),
  );
  const [preview, setPreview] = useState<PublicationPreview | null>(null);
  const [living, setLiving] = useState(publication?.living_research || false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const publishKey = useRef<string | null>(null);
  const withdrawKey = useRef<string | null>(null);
  const previewPanel = useRef<HTMLDivElement>(null);
  function edit(next: PublicContent) {
    setContent(next);
    setPreview(null);
    setConsent(false);
    publishKey.current = null;
    setError('');
  }
  async function prepare(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('Preparing preview');
    setError('');
    setPreview(null);
    setConsent(false);
    try {
      const value = await api<PublicationPreview>(path + '/preview', {
        expected_revision: publication?.revision || 0,
        content,
        living_research: living,
      });
      setPreview(value);
      publishKey.current = uid();
      requestAnimationFrame(() => previewPanel.current?.focus());
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function publish() {
    if (!preview || !consent || busy) return;
    setBusy('Publishing reviewed version');
    setError('');
    try {
      const value = await api<{ publication: Publication }>(path, {
        ...preview,
        request_key: publishKey.current,
        confirm_public: true,
      });
      await onSaved(value.publication);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function withdraw() {
    if (!publication || busy) return;
    setBusy('Withdrawing public version');
    setError('');
    withdrawKey.current ||= uid();
    try {
      const value = await api<{ publication: Publication }>(
        path + '/withdraw',
        {
          expected_revision: publication.revision,
          request_key: withdrawKey.current,
        },
      );
      setWithdrawOpen(false);
      await onSaved(value.publication);
    } catch (failure) {
      setWithdrawOpen(false);
      setError((failure as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <p>
        Edits are saved when you publish. Review the full preview before
        confirming.
      </p>
      <form onSubmit={prepare}>
        <fieldset disabled={!!busy}>
          <label className="publication-consent" htmlFor={`${formId}-living`}>
            <Checkbox
              id={`${formId}-living`}
              checked={living}
              onCheckedChange={(value) => {
                setLiving(value === true);
                edit(content);
              }}
            />
            <span>
              Enable living public research. Future public questions, sources
              and files can be analysed automatically, with findings visible to
              everyone.
            </span>
          </label>
          <p className="discussion-note">
            Private workspace material is excluded. Publishing an edited version
            starts a fresh public research revision; previous derived findings
            stop being public.
          </p>
          <label htmlFor={`${formId}-title`}>
            {'Public title'}
            <Input
              id={`${formId}-title`}
              required
              minLength={3}
              maxLength={240}
              value={content.title}
              onChange={(e) => edit({ ...content, title: e.target.value })}
            />
          </label>
          <label htmlFor={`${formId}-summary`}>
            {'Public summary'}
            <Textarea
              id={`${formId}-summary`}
              required
              minLength={10}
              maxLength={1500}
              rows={3}
              value={content.summary}
              onChange={(e) => edit({ ...content, summary: e.target.value })}
            />
          </label>
          <label htmlFor={`${formId}-author_label`}>
            {'Published by'}
            <Input
              id={`${formId}-author_label`}
              required
              minLength={2}
              maxLength={100}
              placeholder="The name you want readers to see"
              value={content.author_label}
              onChange={(e) =>
                edit({ ...content, author_label: e.target.value })
              }
            />
          </label>
          <label htmlFor={`${formId}-body`}>
            {'Public text'}
            <Textarea
              id={`${formId}-body`}
              required
              minLength={20}
              maxLength={30000}
              rows={12}
              value={content.body}
              onChange={(e) => edit({ ...content, body: e.target.value })}
            />
          </label>
          <div className="publication-links">
            <h3>Public source links · {content.sources.length}/30</h3>
            {content.sources.map((source, index) => (
              <div className="publication-link" key={index}>
                <label htmlFor={`${formId}-source-title-${index}`}>
                  Source {index + 1} title
                  <Input
                    id={`${formId}-source-title-${index}`}
                    required
                    maxLength={240}
                    value={source.title}
                    onChange={(e) =>
                      edit({
                        ...content,
                        sources: content.sources.map((item, i) =>
                          i === index
                            ? { ...item, title: e.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <label htmlFor={`${formId}-source-url-${index}`}>
                  HTTPS address
                  <Input
                    id={`${formId}-source-url-${index}`}
                    required
                    type="url"
                    maxLength={2000}
                    value={source.url}
                    onChange={(e) =>
                      edit({
                        ...content,
                        sources: content.sources.map((item, i) =>
                          i === index ? { ...item, url: e.target.value } : item,
                        ),
                      })
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Remove source ${index + 1}`}
                  onClick={() =>
                    edit({
                      ...content,
                      sources: content.sources.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            {content.sources.length < 30 && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  edit({
                    ...content,
                    sources: [...content.sources, { title: '', url: '' }],
                  })
                }
              >
                Add source link
              </Button>
            )}
          </div>
          <div>
            <Button type="submit">Preview public version</Button>
          </div>
        </fieldset>
      </form>
      <div aria-live="polite">
        {busy && <output>{busy}…</output>}
        {error && (
          <div role="alert" className="banner error">
            {error}
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => void onReload()}
            >
              Reload saved version
            </Button>
          </div>
        )}
      </div>
      {preview && (
        <div
          className="publication-preview"
          ref={previewPanel}
          tabIndex={-1}
          aria-label="Exact public preview"
        >
          <p className="public-reading-note">
            Review exactly what will be visible to everyone. This preview
            expires {date(preview.preview_expires_at)}. Readers can retain a
            reviewed copy in their own workspace; withdrawing the original does
            not recall those copies.
          </p>
          <p className="public-reading-note">
            {preview.living_research
              ? 'Living public research enabled'
              : 'Published snapshot · no automatic public research'}
          </p>
          <PublicContentView content={preview.content} />
          <label htmlFor={`${formId}-consent`} className="publication-consent">
            <Checkbox
              id={`${formId}-consent`}
              checked={consent}
              disabled={!!busy}
              onCheckedChange={(value) => setConsent(value === true)}
            />
            <span>
              I have reviewed this text and these links and confirm they can be
              published publicly, including for search engines.
            </span>
          </label>
          <div className="publication-controls">
            <Button
              disabled={!consent || !!busy}
              onClick={() => void publish()}
            >
              {publication?.status === 'published'
                ? 'Publish updated version'
                : 'Publish for everyone'}
            </Button>
          </div>
        </div>
      )}
      {publication?.status === 'published' && (
        <div className="publication-controls">
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => setWithdrawOpen(true)}
          >
            Withdraw public version
          </Button>
        </div>
      )}
      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this public version?</AlertDialogTitle>
            <AlertDialogDescription>
              Readers will no longer be able to open it here. Copies already
              saved by readers or search engines may remain. Your private
              dossier stays available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>
              Keep published
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!!busy}
              onClick={() => void withdraw()}
            >
              Withdraw version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
