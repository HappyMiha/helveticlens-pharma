'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthDialog } from './auth-dialog';
import { PublicReuse } from './public-reuse';
import { api, date } from '@/lib/api';
import { product } from '@/lib/product';
import type { PublicDossier } from '@/lib/publication';
import { publicHref } from '@/lib/publication';
import type { FollowState, FollowPage } from '@/lib/public-following';
import { useResource } from '@/lib/use-resource';
import {
  usePublicSession,
  publicSessionChanged,
} from '@/lib/use-public-session';

const ROOT = `/products/${product.id}`;
function FollowControls({
  state,
  onChanged,
}: {
  state: FollowState;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function change(read = false) {
    setBusy(true);
    setError('');
    try {
      await api(
        `${ROOT}/public-dossiers/${state.publication_id}/follow${read ? '/read' : ''}`,
        read
          ? { expected_revision: state.revision, marker: state.marker }
          : { expected_revision: state.revision, following: !state.following },
      );
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="follow-controls">
      <div className="public-action-row">
        <Button
          variant={state.following ? 'outline' : 'default'}
          disabled={busy || (!state.available && !state.following)}
          onClick={() => void change()}
        >
          {state.following ? <BellOff size={16} /> : <Bell size={16} />}
          {state.following ? 'Stop following' : 'Follow dossier'}
        </Button>
        {state.following && state.available && (
          <output className="follow-state">
            {state.unread ? 'New public changes' : 'No unseen changes'}
          </output>
        )}
        {state.following && state.unread && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void change(true)}
          >
            <Check size={16} />
            Mark update as seen
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="banner error">
          {error}{' '}
          <Button
            variant="link"
            disabled={busy}
            onClick={() => void onChanged()}
          >
            Refresh state
          </Button>
        </p>
      )}
    </div>
  );
}
export function PublicDossierActions({ dossier }: { dossier: PublicDossier }) {
  const session = usePublicSession();
  const identity =
    !session.error && session.data?.authenticated ? session.data : null;
  const state = useResource<FollowState>(
    identity ? `${ROOT}/public-dossiers/${dossier.id}/follow` : null,
  );
  const [auth, setAuth] = useState(false);
  return (
    <section className="public-personal" aria-label="Your research">
      <div className="public-action-row">
        <h2>Keep this research moving</h2>
        <Link href="/following">Followed dossiers</Link>
      </div>
      <p>
        Follow publication and public discussion changes in your personal list.
        Following sends no email.
      </p>
      {session.error ? (
        <p role="alert">
          {session.error}{' '}
          <Button variant="link" onClick={() => void session.refresh()}>
            Retry sign-in check
          </Button>
        </p>
      ) : !session.data ? (
        <output>Checking sign-in…</output>
      ) : !identity ? (
        <Button onClick={() => setAuth(true)}>
          Sign in to follow or create a private copy
        </Button>
      ) : (
        <>
          <p className="public-meta">Personal to you · {identity.user.name}</p>
          {state.error ? (
            <p role="alert">
              {state.error}{' '}
              <Button variant="link" onClick={() => void state.refresh()}>
                Retry
              </Button>
            </p>
          ) : state.data ? (
            <FollowControls state={state.data} onChanged={state.refresh} />
          ) : (
            <output>Loading your following settings…</output>
          )}
          {identity.role === 'organization_admin' ? (
            <PublicReuse
              key={`${identity.user.id}:${identity.organization.id}`}
              dossier={dossier}
              workspaceName={identity.organization.name}
            />
          ) : (
            <p className="public-meta">
              Creating a private draft requires an administrator role in the
              selected workspace.
            </p>
          )}
        </>
      )}
      <AuthDialog
        open={auth}
        onClose={() => setAuth(false)}
        onSuccess={async () => {
          setAuth(false);
          publicSessionChanged();
        }}
      />
    </section>
  );
}
export function FollowedDossiers() {
  const session = usePublicSession();
  const identity =
    !session.error && session.data?.authenticated ? session.data : null;
  const [auth, setAuth] = useState(false),
    [offset, setOffset] = useState(0);
  const list = useResource<FollowPage>(
    identity ? `${ROOT}/followed-dossiers?offset=${offset}` : null,
  );
  return (
    <section className="followed-library" aria-label="Your followed dossiers">
      {session.error ? (
        <p role="alert">
          {session.error}{' '}
          <Button variant="link" onClick={() => void session.refresh()}>
            Retry sign-in check
          </Button>
        </p>
      ) : !session.data ? (
        <output>Checking sign-in…</output>
      ) : !identity ? (
        <div className="public-empty">
          <h2>Your personal reading list</h2>
          <p>
            Sign in to follow a dossier and return to its public updates. Your
            list is private to your account.
          </p>
          <Button onClick={() => setAuth(true)}>Sign in</Button>
        </div>
      ) : (
        <>
          <div className="public-action-row">
            <p>Signed in as {identity.user.name}</p>
            <Button variant="outline" onClick={() => void list.refresh()}>
              <RefreshCw size={16} />
              Refresh updates
            </Button>
          </div>
          {list.error ? (
            <div role="alert" className="public-empty">
              <p>{list.error}</p>
              <Button onClick={() => void list.refresh()}>Retry loading</Button>
            </div>
          ) : !list.data ? (
            <output>Loading followed dossiers…</output>
          ) : (
            <>
              <p className="public-count">
                {list.data.total} followed{' '}
                {list.data.total === 1 ? 'dossier' : 'dossiers'}
              </p>
              {list.data.items.length ? (
                <div className="public-list">
                  {list.data.items.map((state) => (
                    <article key={state.publication_id}>
                      {state.publication ? (
                        <>
                          <h2>
                            <Link href={publicHref(state.publication_id)}>
                              {state.publication.title}
                            </Link>
                          </h2>
                          <p>{state.publication.summary}</p>
                          <p className="public-meta">
                            {state.publication.author_label} · Published
                            revision {state.publication.revision} · Updated{' '}
                            {date(state.publication.updated_at)}
                          </p>
                        </>
                      ) : (
                        <>
                          <h2>Public dossier unavailable</h2>
                          <p>
                            The author withdrew this publication. Its content is
                            no longer shown here.
                          </p>
                        </>
                      )}
                      <FollowControls state={state} onChanged={list.refresh} />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="public-empty">
                  <h2>
                    {offset
                      ? 'No dossiers on this page'
                      : 'No followed dossiers yet'}
                  </h2>
                  <p>Open a public dossier and choose Follow dossier.</p>
                  <Link href="/public-dossiers">Browse public dossiers</Link>
                  {offset > 0 && (
                    <Button variant="link" onClick={() => setOffset(0)}>
                      First page
                    </Button>
                  )}
                </div>
              )}
              {(offset > 0 ||
                offset + list.data.page_size < list.data.total) && (
                <nav
                  className="public-action-row"
                  aria-label="Followed dossier pages"
                >
                  <Button
                    variant="outline"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - 20))}
                  >
                    Previous page
                  </Button>
                  <span>Page {Math.floor(offset / 20) + 1}</span>
                  <Button
                    variant="outline"
                    disabled={offset + 20 >= list.data.total}
                    onClick={() => setOffset(offset + 20)}
                  >
                    Next page
                  </Button>
                </nav>
              )}
            </>
          )}
        </>
      )}
      <AuthDialog
        open={auth}
        onClose={() => setAuth(false)}
        onSuccess={async () => {
          setAuth(false);
          setOffset(0);
          publicSessionChanged();
        }}
      />
    </section>
  );
}
