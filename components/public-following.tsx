'use client';
import { useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthDialog } from './auth-dialog';
import { PublicReuse } from './public-reuse';
import { date } from '@/lib/api';
import { product } from '@/lib/product';
import type { PublicDossier } from '@/lib/publication';
import { publicHref } from '@/lib/publication';
import type { FollowState, FollowPage } from '@/lib/public-following';
import { usePersonalUpdates } from '@/lib/use-personal-updates';
import {
  FollowControls,
  PrivateFollowedDossiers,
  ResearchUpdates,
} from './research-following';
import {
  usePublicSession,
  publicSessionChanged,
} from '@/lib/use-public-session';

const ROOT = `/products/${product.id}`;
export function PublicDossierActions({ dossier }: { dossier: PublicDossier }) {
  const session = usePublicSession();
  const identity =
    !session.error && session.data?.authenticated ? session.data : null;
  const state = usePersonalUpdates<FollowState>(
    identity
      ? `${ROOT}/public-dossiers/${dossier.id}/follow?account=${encodeURIComponent(identity.user.id + ':' + identity.organization.id)}`
      : null,
  );
  const [auth, setAuth] = useState(false);
  return (
    <section className="public-personal" aria-label="Your research">
      <div className="public-action-row">
        <h2>Keep this research moving</h2>
        <Link href="/following">Followed dossiers</Link>
      </div>
      <p>
        Follow publications, public discussion and completed research in your
        personal list. Following sends no email.
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
            <FollowControls
              audience="public"
              id={dossier.id}
              state={state.data}
              onChanged={state.refresh}
            />
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
  const list = usePersonalUpdates<FollowPage>(
    identity
      ? `${ROOT}/followed-dossiers?offset=${offset}&account=${encodeURIComponent(identity.user.id + ':' + identity.organization.id)}`
      : null,
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
            Sign in to follow private or public dossiers and return to their
            research updates. Your list is private to your account.
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
          <PrivateFollowedDossiers
            key={`${identity.user.id}:${identity.organization.id}`}
            accountKey={`${identity.user.id}:${identity.organization.id}`}
          />
          <h2>Public dossiers</h2>
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
                      <FollowControls
                        audience="public"
                        id={state.publication_id}
                        state={state}
                        onChanged={list.refresh}
                      />
                      {state.available && (
                        <ResearchUpdates
                          key={`${identity.user.id}:${identity.organization.id}:${state.publication_id}`}
                          audience="public"
                          id={state.publication_id}
                          accountKey={`${identity.user.id}:${identity.organization.id}`}
                        />
                      )}
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
