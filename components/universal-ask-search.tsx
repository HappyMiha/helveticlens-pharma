'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { askBoundary, isAskShortcut } from '@/lib/ask-interaction';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowUpRight,
  BookOpen,
  FolderSearch,
  Globe,
  Search,
  Waypoints,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { api, uid } from '@/lib/api';
import type { Identity, DiscoveryResult, SearchHit } from '@/lib/contracts';
import type { DecisionRun } from '@/lib/decision-search';
import type { PublicKnowledgePage } from '@/lib/public-research';
import { product } from '@/lib/product';
import { discoveryPath } from '@/lib/discovery-pages';
import { discoveryTarget, dossierHref } from '@/lib/dossier-navigation';
import { sourceHref } from '@/lib/investigation';
import { LensProgress } from './lens';
import { ProductDestinations } from './product-destinations';

export type AskScope = {
  id: string;
  title: string;
  canInvestigate: boolean;
  unavailable: boolean;
  investigate: (question: string) => Promise<boolean>;
  searchEvidence?: (question: string) => void;
};
type AskEnvironment = {
  openAsk: () => void;
  register: (scope: AskScope) => () => void;
};
const AskContext = createContext<AskEnvironment>({
  openAsk: () => {},
  register: () => () => {},
});
export const useAskSearch = () => useContext(AskContext);
type Destination = 'workspace' | 'public' | 'web' | 'investigate' | 'evidence';
type Result = {
  title: string;
  href: string;
  detail: string;
  external?: boolean;
};

export const PUBLIC_QUERY_DISCLOSURE =
  'Investigate sends this question and newly found public entity names to public search. Saved dossier evidence uses your workspace AI. Keep confidential details out of this field.';

export function AskTrigger({
  label = 'Ask Helvetic Lens or search anything…',
  disabled = false,
}: {
  label?: string;
  disabled?: boolean;
}) {
  const { openAsk } = useAskSearch();
  return (
    <Button
      variant="outline"
      type="button"
      aria-keyshortcuts="Meta+K Control+K"
      className="ask-trigger"
      onClick={openAsk}
      disabled={disabled}
    >
      <Search size={18} />
      <span>{label}</span>
      <kbd>⌘ / Ctrl K</kbd>
    </Button>
  );
}

type PendingSearch = { fingerprint: string; key: string } | null;
export function UniversalAskSearch({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scope, setScope] = useState<AskScope | null>(null);
  const opener = useRef<(() => void) | null>(null);
  const pending = useRef<PendingSearch>(null);
  const searchKey = useCallback((fingerprint: string) => {
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, key: uid() };
    return pending.current.key;
  }, []);
  const clearPending = useCallback(() => {
    pending.current = null;
  }, []);
  const register = useCallback((next: AskScope) => {
    setScope(next);
    return () => setScope((old) => (old === next ? null : old));
  }, []);
  const registerOpen = useCallback((next: () => void) => {
    opener.current = next;
    return () => {
      if (opener.current === next) opener.current = null;
    };
  }, []);
  const openAsk = useCallback(() => opener.current?.(), []);
  return (
    <AskContext.Provider value={{ openAsk, register }}>
      {children}
      <AskDialog
        key={askBoundary(pathname, scope?.id)}
        scope={scope}
        registerOpen={registerOpen}
        searchKey={searchKey}
        clearPending={clearPending}
      />
    </AskContext.Provider>
  );
}

function AskDialog({
  scope,
  registerOpen,
  searchKey,
  clearPending,
}: {
  scope: AskScope | null;
  registerOpen: (open: () => void) => () => void;
  searchKey: (fingerprint: string) => string;
  clearPending: () => void;
}) {
  const queryInput = useRef<HTMLInputElement>(null);
  const draftOwner = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<Destination | null>(null);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const [coverage, setCoverage] = useState('');
  const [searched, setSearched] = useState('');
  const epoch = useRef(0);
  const sessionEpoch = useRef(0);
  const openAsk = useCallback(() => {
    if (open) {
      queryInput.current?.focus();
      return;
    }
    const attempt = ++sessionEpoch.current;
    epoch.current++;
    setOpen(true);
    setChecking(true);
    setIdentity(null);
    setResults(null);
    setCoverage('');
    setError('');
    api<Identity>('/auth/session')
      .then((value) => {
        if (attempt === sessionEpoch.current) {
          const owner = askBoundary(
            '',
            value.authenticated ? value.organization.id : '',
            value.authenticated ? value.user.id : '',
            '',
            value.authenticated ? value.role : '',
          );
          if (draftOwner.current !== null && draftOwner.current !== owner) {
            setQuery('');
            clearPending();
          }
          draftOwner.current = owner;
          setIdentity(value.authenticated ? value : null);
          setChecking(false);
        }
      })
      .catch(() => {
        if (attempt === sessionEpoch.current) {
          setChecking(false);
          setQuery('');
          setError(
            'Workspace access could not be checked. Public dossiers are still available.',
          );
        }
      });
  }, [open, clearPending]);
  const close = useCallback(() => {
    epoch.current++;
    sessionEpoch.current++;
    setOpen(false);
    setResults(null);
    setIdentity(null);
    setError('');
    setBusy(null);
    setCoverage('');
  }, []);
  const reset = useCallback(() => {
    close();
    setQuery('');
  }, [close]);
  const resetSession = useCallback(() => {
    reset();
    clearPending();
    draftOwner.current = null;
  }, [reset, clearPending]);
  useEffect(() => registerOpen(openAsk), [openAsk, registerOpen]);
  useEffect(() => {
    if (!open || checking) return;
    const frame = requestAnimationFrame(() =>
      queryInput.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [open, checking]);
  useEffect(
    () => () => {
      epoch.current++;
      sessionEpoch.current++;
    },
    [],
  );
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const dialog =
        event.target instanceof Element
          ? event.target.closest(
              'dialog[open], [role="dialog"], [role="alertdialog"]',
            )
          : null;
      if (!isAskShortcut(event, dialog)) return;
      event.preventDefault();
      if (open) queryInput.current?.focus();
      else openAsk();
    };
    window.addEventListener('keydown', keyboard);
    window.addEventListener('helvetic-session-changed', resetSession);
    window.addEventListener('popstate', reset);
    return () => {
      window.removeEventListener('keydown', keyboard);
      window.removeEventListener('helvetic-session-changed', resetSession);
      window.removeEventListener('popstate', reset);
    };
  }, [open, openAsk, reset, resetSession]);
  const admin = identity?.role === 'organization_admin';
  const ready = query.trim().length >= 2 && !busy && !checking;
  async function submit(destination: Destination) {
    if (
      !ready ||
      (destination === 'evidence' && (!identity || !scope?.searchEvidence)) ||
      (destination === 'workspace' && !identity) ||
      (destination === 'web' && !admin) ||
      (destination === 'investigate' && !identity)
    )
      return;
    const question = query.trim();
    const attempt = ++epoch.current;
    setBusy(destination);
    setError('');
    setResults(null);
    setCoverage('');
    setSearched(question);
    try {
      if (destination === 'evidence') {
        scope?.searchEvidence?.(question);
        reset();
        return;
      }
      if (destination === 'investigate') {
        if (!scope?.canInvestigate || scope.unavailable) return;
        const success = await scope.investigate(question);
        if (epoch.current !== attempt) return;
        if (success) reset();
        else
          setError(
            'The investigation could not start. Its saved progress and error are shown in the dossier.',
          );
        return;
      }
      let found: Result[];
      let description: string;
      if (destination === 'public') {
        const page = await api<PublicKnowledgePage>(
          `/products/${product.id}/public-knowledge?${new URLSearchParams({ q: question })}`,
        );
        found = page.items.map((item) => ({
          title: item.label,
          href: item.href,
          detail: `${item.kind} · ${item.dossier_title} · ${item.text}`,
        }));
        description = `${page.total} public knowledge items match all search words. Showing the first ${page.items.length}. Only author-published material is searched.`;
      } else {
        let hits: SearchHit[];
        if (destination === 'workspace') {
          const page = await api<DiscoveryResult>(
            discoveryPath(product.id, {
              query: question,
              provider: 'workspace',
              match_mode: 'all',
            }),
          );
          hits = page.items;
          description = page.coverage;
        } else {
          const fingerprint = JSON.stringify([
            identity?.organization.id,
            identity?.user.id,
            question,
          ]);
          const requestKey = searchKey(fingerprint);
          const run = await api<DecisionRun>(
            `/products/${product.id}/discover/decision`,
            {
              request_key: requestKey,
              query: question,
              mode: 'auto',
              depth: 'balanced',
              alternatives: [],
              public_query_confirmed: true,
            },
          );
          if (run.status !== 'running' && epoch.current === attempt)
            clearPending();
          hits = run.items;
          description =
            run.coverage ||
            'A bounded search of accessible public indexes. Search snippets are leads, not verified evidence.';
          if (run.status === 'failed' || run.status === 'interrupted')
            description =
              'This search did not finish. Any returned leads need review. Reopen its saved run in the source tools for details.';
          if (run.status === 'running')
            description =
              'This search is still recorded as running. Retry this same query to recover the saved run without creating another request.';
        }
        found = hits.flatMap((hit) => {
          const target =
            destination === 'workspace' ? discoveryTarget(hit) : null;
          const href = target ? dossierHref(target) : sourceHref(hit.url);
          return href
            ? [
                {
                  title: hit.title,
                  href,
                  detail: hit.summary,
                  external: !target,
                },
              ]
            : [];
        });
      }
      if (epoch.current !== attempt) return;
      setResults(found);
      setCoverage(description);
    } catch (failure) {
      if (epoch.current === attempt)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Search could not finish. Try again.',
        );
    } finally {
      if (epoch.current === attempt) setBusy(null);
    }
  }
  return (
    <>
      <div className="universal-ask">
        <AskTrigger />
      </div>
      <Dialog open={open} onOpenChange={(next) => (next ? openAsk() : close())}>
        <DialogContent
          className="ask-palette"
          data-helvetic-ask="true"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>Ask / Search</DialogTitle>
            <DialogDescription>
              {scope
                ? `Research in ${scope.title}`
                : 'Find sources, public dossiers and knowledge in your workspace.'}
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false} className="ask-command">
            <CommandInput
              ref={queryInput}
              aria-label="Ask Helvetic Lens or search anything"
              placeholder="A question, a source, a topic…"
              value={checking ? '' : query}
              maxLength={300}
              disabled={!!busy || checking}
              onValueChange={(value) => {
                setQuery(value);
                setResults(null);
                setCoverage('');
                setError('');
              }}
            />
            <CommandList>
              <CommandGroup
                heading={
                  query.trim()
                    ? 'Choose where to look'
                    : 'Start with a question or a few search words'
                }
              >
                {scope && (
                  <CommandItem
                    value="investigate"
                    disabled={
                      !ready ||
                      checking ||
                      !identity ||
                      !scope.canInvestigate ||
                      scope.unavailable
                    }
                    onSelect={() => void submit('investigate')}
                  >
                    <Waypoints />
                    <span>
                      Investigate this dossier
                      <small>
                        {scope.unavailable
                          ? 'Another investigation is active'
                          : 'Find sources and build an evidence trail'}
                      </small>
                    </span>
                  </CommandItem>
                )}
                {scope?.searchEvidence && (
                  <CommandItem
                    value="evidence"
                    disabled={!ready || checking || !identity}
                    onSelect={() => void submit('evidence')}
                  >
                    <FolderSearch />
                    <span>
                      Search this dossier’s evidence
                      <small>
                        Meaning and exact citations · private local search
                      </small>
                    </span>
                  </CommandItem>
                )}
                <CommandItem
                  value="workspace"
                  disabled={!ready || checking || !identity}
                  onSelect={() => void submit('workspace')}
                >
                  <FolderSearch />
                  <span>
                    Search your workspace
                    <small>
                      {checking
                        ? 'Checking access…'
                        : identity
                          ? 'Dossiers, questions and saved references · all words'
                          : 'Sign in from the workspace to search private knowledge'}
                    </small>
                  </span>
                </CommandItem>
                <CommandItem
                  value="public"
                  disabled={!ready}
                  onSelect={() => void submit('public')}
                >
                  <BookOpen />
                  <span>
                    Search public dossiers
                    <small>Published research · no account needed</small>
                  </span>
                </CommandItem>
                <CommandItem
                  value="web"
                  disabled={!ready || checking || !admin}
                  onSelect={() => void submit('web')}
                >
                  <Globe />
                  <span>
                    Search the public web
                    <small>
                      {admin
                        ? 'Sends only the question above to public search providers'
                        : 'Workspace administrator access required'}
                    </small>
                  </span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
          <p className="ask-privacy">
            {scope
              ? PUBLIC_QUERY_DISCLOSURE
              : 'Public web search sends the question above to external providers. Keep confidential details in workspace search. Typing alone does not send a query.'}
          </p>
          {error && (
            <p role="alert" className="investigation-error">
              {error}
            </p>
          )}
          {busy && (
            <LensProgress
              activity={{
                state: busy === 'web' ? 'searching' : 'idle',
                label:
                  busy === 'investigate'
                    ? 'Saving your investigation'
                    : 'Searching',
                detail:
                  busy === 'web'
                    ? 'Discovering and ranking public source leads.'
                    : 'Reading permitted records.',
              }}
            />
          )}
          {results && (
            <section className="ask-results" aria-label="Search results">
              <output>
                {results.length} results shown for “{searched}”
              </output>
              <p>{coverage}</p>
              {!results.length && (
                <p>
                  No matching results were returned. Try fewer words or another
                  search scope.
                </p>
              )}
              {results.map((result, i) => (
                <a
                  key={`${result.href}:${i}`}
                  href={result.href}
                  target={result.external ? '_blank' : undefined}
                  rel={
                    result.external
                      ? 'noopener noreferrer nofollow ugc'
                      : undefined
                  }
                  onClick={() => close()}
                >
                  <strong>
                    {result.title}
                    {result.external && <ArrowUpRight size={15} />}
                  </strong>
                  <span>{result.detail}</span>
                </a>
              ))}
            </section>
          )}
          <ProductDestinations current={product.id} />
          <div className="ask-navigation">
            <Link href="/" onClick={close}>
              Workspace
            </Link>
            <Link href="/public-dossiers" onClick={close}>
              Public dossiers
            </Link>
            <Link href="/guide" onClick={close}>
              Guide
            </Link>
            <small>
              ↑ ↓ to choose · Enter to run · Esc keeps your question
            </small>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
