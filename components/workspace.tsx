'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  CalendarClock,
  MessagesSquare,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Cross,
  FolderOpen,
  Globe,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type {
  DossierRecord,
  DossiersPage,
  Identity,
  Invitation,
  Member,
  NavigationItem,
  Preset,
  ProfileConfig,
  ProfilesPage,
  Run,
  SourceCatalogue,
  SourcePack,
} from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { api, date, text } from '@/lib/api';
import { product } from '@/lib/product';
import {
  readDossierLink,
  recordDossierNavigation,
} from '@/lib/dossier-navigation';
import { Wizard } from './wizard';
import { Dossier } from './dossier';
import { Workbench } from './workbench';
import { ResearchDesk } from './research-desk';

export const ROOT = `/products/${product.id}/dossiers`;
export const emptyConfig = (): ProfileConfig => ({
  audience: 'client',
  name: '',
  sector: product.id === 'pharma' ? 'Pharmaceuticals' : 'Legal services',
  goal: '',
  feedback: '',
  requested_jurisdictions: 'Switzerland',
  topics: [],
  source_pack_ids: ['fedlex-legislation'],
  source_requests: [],
  delivery: 'keep',
  delivery_consent: false,
});
export function Brand() {
  const Icon = product.id === 'pharma' ? Cross : Scale;
  return (
    <span className="brand">
      <span className="brandmark">
        <Icon size={20} />
      </span>
      <span>
        <b>HelveticLens</b>
        <small>{product.name}</small>
      </span>
    </span>
  );
}
export function Empty({
  title,
  children,
  icon: Icon = FolderOpen,
}: {
  title: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Status({ status }: { status: string }) {
  return (
    <span className={`status status-${status}`}>
      <span />
      {status === 'active'
        ? 'Active'
        : status === 'draft'
          ? 'Draft'
          : status === 'paused'
            ? 'Paused'
            : status}
    </span>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Sources({
  packs,
  selection,
  onToggle,
  extraSelection,
  onExtraToggle,
}: {
  packs: SourcePack[];
  selection?: string[];
  onToggle?: (id: string) => void;
  extraSelection?: string[];
  onExtraToggle?: (id: string) => void;
}) {
  return (
    <>
      <div className="section-label">Scheduled Swiss source collections</div>
      <div className="source-grid">
        {packs.map((p) => (
          <article
            className={`source-card ${selection?.includes(p.id) ? 'selected' : ''}`}
            key={p.id}
          >
            <div className="source-head">
              <span className="source-icon">
                <BookOpen size={20} />
              </span>
              {onToggle && (
                <Checkbox
                  aria-label={`Monitor ${text(p.name)}`}
                  checked={selection?.includes(p.id)}
                  onCheckedChange={() => onToggle(p.id)}
                />
              )}
            </div>
            <h3>{text(p.name)}</h3>
            <p>{text(p.description)}</p>
            <div className="source-foot">
              <span className={p.last_success_at ? 'good' : 'muted'}>
                {p.last_success_at
                  ? 'Last success ' + date(p.last_success_at)
                  : 'No successful collection reported'}
              </span>
              {p.partial && <span className="tag">Partial coverage</span>}
            </div>
            {p.known_gaps?.length > 0 && (
              <details>
                <summary>Coverage details</summary>
                <p>{p.known_gaps.join(' ')}</p>
              </details>
            )}
          </article>
        ))}
      </div>
      <div className="section-label spaced">
        Recommended primary-source pages
      </div>
      <p className="muted">
        These are individual page watches. Each page is fetched and verified
        when you explicitly connect it; this does not crawl the whole website.
      </p>
      <div className="source-grid">
        {product.recommended.map((p) => (
          <article
            className={`source-card ${extraSelection?.includes(p.id) ? 'selected' : ''}`}
            key={p.id}
          >
            <div className="source-head">
              <span className="source-icon">
                <Globe size={20} />
              </span>
              {onExtraToggle && (
                <Checkbox
                  aria-label={`Choose ${p.name}`}
                  checked={extraSelection?.includes(p.id)}
                  onCheckedChange={() => onExtraToggle(p.id)}
                />
              )}
            </div>
            <div className="eyebrow">{p.jurisdiction}</div>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="source-link"
            >
              Open primary source <ArrowUpRight size={15} />
            </a>
          </article>
        ))}
      </div>
    </>
  );
}

export default function Workspace() {
  const [identity, setIdentity] = useState<Identity | null>(null),
    [loading, setLoading] = useState(true),
    [items, setItems] = useState<DossierRecord[]>([]),
    [total, setTotal] = useState(0),
    [packs, setPacks] = useState<SourcePack[]>([]),
    [view, setView] = useState('research'),
    [questionId, setQuestionId] = useState<string | null>(null),
    [referenceId, setReferenceId] = useState<string | null>(null),
    [navigationVersion, setNavigationVersion] = useState(0),
    [refreshToken, setRefreshToken] = useState(0),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<DossierRecord | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(''),
    [login, setLogin] = useState(false),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [seed, setSeed] = useState<Preset | null>(null),
    [emailAvailable, setEmailAvailable] = useState(false);
  const navigation = useRef({ value: 0 });
  const canEdit = identity?.role === 'organization_admin';
  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  const refresh = useCallback(async () => {
    const [docs, catalogue, profiles] = await Promise.all([
      api<DossiersPage>(ROOT),
      api<SourceCatalogue>('/source-packs'),
      api<ProfilesPage>('/monitoring-profiles'),
    ]);
    setItems(docs.items);
    setTotal(docs.total);
    setPacks(catalogue.items);
    setEmailAvailable(profiles.email_available);
    setRefreshToken((n) => n + 1);
  }, []);
  const openDossier = useCallback(
    async (
      id: string,
      threadId?: string | null,
      sourceId?: string | null,
      push = true,
      resetView = true,
    ) => {
      const attempt = ++navigation.current.value;
      try {
        const d = await api<DossierRecord>(`${ROOT}/${encodeURIComponent(id)}`);
        if (attempt !== navigation.current.value) return;
        setSelected(d);
        if (resetView) setNavigationVersion((version) => version + 1);
        setQuestionId(sourceId ? null : threadId || null);
        setReferenceId(sourceId || null);
        setView(
          d.profile.status === 'draft' && !sourceId && !threadId
            ? 'wizard'
            : 'detail',
        );
        recordDossierNavigation(
          window.history,
          { id, questionId: threadId, referenceId: sourceId },
          push,
        );
      } catch (error) {
        if (attempt !== navigation.current.value) return;
        if (!push) {
          setSelected(null);
          setView('research');
        }
        throw error;
      }
    },
    [],
  );
  useEffect(() => {
    const counter = navigation.current;
    let disposed = false;
    async function boot() {
      try {
        const session = await api<Identity>('/auth/session');
        if (disposed) return;
        setIdentity(session.authenticated ? session : null);
        if (session.authenticated) {
          await refresh();
          if (disposed) return;
          const target = readDossierLink(window.location.search);
          if (target)
            await openDossier(
              target.id,
              target.questionId,
              target.referenceId,
              false,
            );
          else {
            const page = new URLSearchParams(window.location.search).get(
              'view',
            );
            if (
              page &&
              ['research', 'today', 'dossiers', 'sources', 'team'].includes(
                page,
              )
            )
              setView(page);
          }
        }
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void boot();
    const pop = () => {
      const target = readDossierLink(window.location.search);
      if (target)
        void openDossier(
          target.id,
          target.questionId,
          target.referenceId,
          false,
        ).catch((e) => setError((e as Error).message));
      else {
        navigation.current.value++;
        const page = new URLSearchParams(window.location.search).get('view');
        setView(
          page &&
            ['research', 'today', 'dossiers', 'sources', 'team'].includes(page)
            ? page
            : 'research',
        );
        setSelected(null);
      }
    };
    window.addEventListener('popstate', pop);
    return () => {
      disposed = true;
      counter.value++;
      window.removeEventListener('popstate', pop);
    };
  }, [openDossier, refresh]);
  function go(next: string) {
    navigation.current.value++;
    setQuestionId(null);
    setReferenceId(null);
    setView(next);
    setSelected(null);
    setError('');
    setNotice('');
    window.history.pushState(
      {},
      '',
      next === 'research' ? '/' : `/?view=${next}`,
    );
  }
  function start(example?: Preset) {
    setCreating(true);
    setSeed(example || null);
    if (!identity) {
      setLogin(true);
      return;
    }
    if (!canEdit) {
      setError(
        'Your workspace role is read-only. An administrator can create monitoring dossiers.',
      );
      return;
    }
    setSelected(null);
    setView('wizard');
    window.history.pushState({}, '', '/?view=new');
  }
  const filtered = items.filter(
    (x) =>
      (filter === 'all' || x.profile.status === filter) &&
      `${x.profile.config.name} ${x.profile.config.goal} ${x.work?.context.subject || ''} ${x.work?.context.reference || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <SidebarProvider>
      <Sidebar className="product-sidebar">
        <SidebarHeader>
          <Link href="/" aria-label={`HelveticLens ${product.name} home`}>
            <Brand />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-label">WORKSPACE</div>
          <nav className="side-nav" aria-label="Workspace navigation">
            {(
              [
                ['research', 'Topics', MessagesSquare],
                ['today', 'Review desk', CalendarClock],
                ['dossiers', 'Dossier library', FolderOpen],
                ['sources', 'Source library', Globe],
                ['team', 'Team & access', Users],
              ] as NavigationItem[]
            ).map(([id, label, Icon]) => (
              <Button
                key={id}
                variant="ghost"
                className={
                  view === id ||
                  (id === 'research' && ['wizard', 'detail'].includes(view))
                    ? 'nav-active'
                    : ''
                }
                onClick={() => go(id)}
              >
                <Icon size={18} />
                {label}
                {id === 'dossiers' && identity && <span>{total}</span>}
              </Button>
            ))}
          </nav>
          <div className="sidebar-note">
            <div className="mini-cross">+</div>
            <p>{product.description}</p>
            <a href="https://helveticlens.ch" target="_blank" rel="noreferrer">
              Open full platform <ArrowUpRight size={14} />
            </a>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <div className="workspace-identity">
            <span className="avatar">
              {identity?.user?.name?.slice(0, 2).toUpperCase() || 'HL'}
            </span>
            <div>
              <b>{identity?.organization?.name || 'Your private workspace'}</b>
              <small>
                {identity
                  ? canEdit
                    ? 'Workspace administrator'
                    : 'Read-only member'
                  : 'Sign in to save your monitoring'}
              </small>
            </div>
          </div>
          {identity ? (
            <Button
              variant="ghost"
              onClick={() =>
                run('Signing out', async () => {
                  await api('/auth/logout', {});
                  setIdentity(null);
                  setItems([]);
                  setTotal(0);
                  setPacks([]);
                  setSelected(null);
                  go('research');
                })
              }
            >
              <LogOut size={15} />
              Sign out
            </Button>
          ) : (
            <Button
              onClick={() => {
                setCreating(false);
                setLogin(true);
              }}
            >
              <LockKeyhole size={15} />
              Sign in
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="workspace-header">
          <div className="crumb">
            <SidebarTrigger />
            <span>{product.name}</span>
            <ChevronRight size={15} />
            <b>
              {view === 'wizard'
                ? 'New monitoring'
                : view === 'detail'
                  ? 'Dossier'
                  : view === 'sources'
                    ? 'Source library'
                    : view === 'team'
                      ? 'Team & access'
                      : view === 'today'
                        ? 'Review desk'
                        : view === 'research'
                          ? 'Living topics'
                          : 'Monitoring dossiers'}
            </b>
          </div>
          <div className="header-actions">
            <span className="private-note">
              <LockKeyhole size={13} />
              Private by workspace
            </span>
            {identity && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh workspace"
                disabled={!!busy}
                onClick={() =>
                  run('Refreshing', async () => {
                    await refresh();
                    const target = readDossierLink(window.location.search);
                    if (selected && target?.id === selected.id)
                      await openDossier(
                        target.id,
                        target.questionId,
                        target.referenceId,
                        false,
                        false,
                      );
                  })
                }
              >
                <RefreshCw size={18} />
              </Button>
            )}
            {!identity && (
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setLogin(true);
                }}
              >
                Sign in
              </Button>
            )}
          </div>
        </header>
        <main className="product-main" aria-busy={!!busy}>
          <div aria-live="polite">
            {error && (
              <div role="alert" className="banner error">
                <span>{error}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Dismiss error"
                  onClick={() => setError('')}
                >
                  <X size={16} />
                </Button>
              </div>
            )}
            {notice && (
              <div className="banner success">
                <Check size={18} />
                {notice}
              </div>
            )}
            {busy && (
              <div className="working">
                <LoaderCircle size={15} className="spin" />
                {busy}…
              </div>
            )}
          </div>
          {loading ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              Connecting to your workspace…
            </div>
          ) : (
            <>
              {view === 'research' && (
                <ResearchDesk
                  identity={identity}
                  items={items}
                  total={total}
                  busy={busy}
                  run={run}
                  onStart={start}
                  onOpen={openDossier}
                  onMore={async () => {
                    const next = await api<DossiersPage>(
                      `${ROOT}?offset=${items.length}`,
                    );
                    setItems((current) => [
                      ...current,
                      ...next.items.filter(
                        (x) => !current.some((y) => y.id === x.id),
                      ),
                    ]);
                    setTotal(next.total);
                  }}
                />
              )}
              {view === 'today' && (
                <Workbench
                  identity={identity}
                  busy={busy}
                  run={run}
                  refreshToken={refreshToken}
                  onStart={() => start()}
                  onOpen={openDossier}
                  onBrowse={() => go('dossiers')}
                />
              )}
              {view === 'dossiers' && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">{product.eyebrow}</div>
                      <h1>
                        Your monitoring,
                        <br />
                        <em>with the whole story.</em>
                      </h1>
                      <p>
                        From a question to a living dossier. Sources, evidence
                        and your team’s decisions, together.
                      </p>
                    </div>
                    <Button
                      className="primary-cta"
                      disabled={(identity && !canEdit) || !!busy}
                      onClick={() => start()}
                    >
                      <Plus size={18} />
                      New monitoring
                    </Button>
                  </div>
                  <div className="overview-strip">
                    <div>
                      <span className="stat">
                        {
                          items.filter((d) => d.profile.status === 'active')
                            .length
                        }
                        {total > items.length ? '+' : ''}
                      </span>
                      <span>Active dossiers</span>
                    </div>
                    <div>
                      <span className="stat">
                        {
                          items.filter((d) => d.profile.status === 'draft')
                            .length
                        }
                      </span>
                      <span>Drafts to continue</span>
                    </div>
                    <div className="overview-description">
                      <Activity size={22} />
                      <span>
                        {identity
                          ? 'Your saved monitoring profiles, linked to the HelveticLens evidence pipeline.'
                          : 'A clear path from “what changed?” to “what matters to us?”'}
                      </span>
                    </div>
                  </div>
                  {items.length > 0 ? (
                    <>
                      <div className="list-toolbar">
                        <div className="search-field">
                          <Search size={17} />
                          <Input
                            aria-label="Search dossiers"
                            placeholder="Search your dossiers"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        <div className="filters">
                          {['all', 'active', 'draft', 'paused'].map((f) => (
                            <Button
                              key={f}
                              variant={filter === f ? 'secondary' : 'ghost'}
                              onClick={() => setFilter(f)}
                            >
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="dossier-grid">
                        {filtered.map((d) => (
                          <button
                            className="dossier-card"
                            key={d.id}
                            disabled={!!busy}
                            onClick={() =>
                              run('Opening dossier', () => openDossier(d.id))
                            }
                          >
                            <div className="card-top">
                              <span className="dossier-icon">
                                <FolderOpen size={22} />
                              </span>
                              <Status status={d.profile.status} />
                            </div>
                            <h2>{d.profile.config.name || 'Untitled draft'}</h2>
                            <p>
                              {d.profile.config.goal ||
                                'Continue describing what you want to monitor.'}
                            </p>
                            {d.work?.context.subject && (
                              <div className="card-context">
                                {d.work.context.subject}
                                {d.work.context.reference &&
                                  ` · ${d.work.context.reference}`}
                              </div>
                            )}
                            {d.work?.review_due && (
                              <span className="work-overdue">
                                Review due · {d.work.next_review_on}
                              </span>
                            )}
                            <div className="dossier-meta">
                              <span>
                                {
                                  d.profile.config.topics.filter(
                                    (x) => x.selected,
                                  ).length
                                }{' '}
                                topics
                              </span>
                              <span>
                                {d.profile.config.source_pack_ids.length} source
                                collections
                              </span>
                            </div>
                            <div className="card-bottom">
                              <span>Updated {date(d.profile.updated_at)}</span>
                              <ArrowRight size={17} />
                            </div>
                          </button>
                        ))}
                      </div>
                      {!filtered.length && (
                        <Empty title="No dossiers match this search">
                          Try another name or status.
                        </Empty>
                      )}
                      {total > items.length && (
                        <Button
                          variant="outline"
                          disabled={!!busy}
                          onClick={() =>
                            run('Loading dossiers', async () => {
                              const next = await api<DossiersPage>(
                                `${ROOT}?offset=${items.length}`,
                              );
                              setItems([...items, ...next.items]);
                            })
                          }
                        >
                          Load more dossiers
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="first-monitor">
                      <div className="first-monitor-copy">
                        <span className="source-icon">
                          <Sparkles size={24} />
                        </span>
                        <h2>Start with what matters to you.</h2>
                        <p>
                          Describe a {product.noun}, a question or a change you
                          need to follow. AI helps shape the topics; you choose
                          what goes live.
                        </p>
                        <div className="flow-line">
                          <span>Describe</span>
                          <ArrowRight />
                          <span>Refine</span>
                          <ArrowRight />
                          <span>Monitor</span>
                        </div>
                      </div>
                      <div className="starter-list">
                        {product.examples.map((e, i) => (
                          <button key={e.name} onClick={() => start(e)}>
                            <span className="starter-number">0{i + 1}</span>
                            <span>
                              <b>{e.name}</b>
                              <small>{e.goal}</small>
                            </span>
                            <ArrowUpRight size={20} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <footer className="page-foot">
                    <span>
                      <ShieldCheck size={15} /> Evidence stays linked to its
                      primary source.
                    </span>
                    <span>
                      Apache 2.0 ·{' '}
                      <a
                        href={`https://github.com/HappyMiha/helveticlens-${product.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source
                      </a>
                    </span>
                  </footer>
                </>
              )}
              {view === 'wizard' && identity && (
                <Wizard
                  initial={selected}
                  seed={seed}
                  packs={packs}
                  emailAvailable={emailAvailable}
                  identity={identity}
                  busy={busy}
                  run={run}
                  onCancel={() => go('research')}
                  onSaved={async (d: DossierRecord) => {
                    setSelected(d);
                    await refresh();
                  }}
                  onActivated={async (id: string) => {
                    await refresh();
                    await openDossier(id);
                    setNotice(
                      'Your monitoring dossier is active. Source connection results are shown in the evidence tab.',
                    );
                  }}
                />
              )}
              {view === 'detail' && selected && (
                <Dossier
                  key={`${selected.id}:${navigationVersion}`}
                  initialQuestionId={questionId}
                  initialReferenceId={referenceId}
                  onReferenceChange={(id) => {
                    navigation.current.value++;
                    setReferenceId(id);
                    setQuestionId(null);
                    recordDossierNavigation(
                      window.history,
                      { id: selected.id, referenceId: id },
                      true,
                    );
                  }}
                  dossier={selected}
                  canEdit={canEdit}
                  busy={busy}
                  run={run}
                  onBack={() => go('research')}
                  reload={async () => {
                    setSelected(
                      await api<DossierRecord>(`${ROOT}/${selected.id}`),
                    );
                    await refresh();
                  }}
                  notify={setNotice}
                />
              )}
              {view === 'sources' && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">EVIDENCE STARTS HERE</div>
                      <h1>Know your sources.</h1>
                      <p>
                        Official collections and specific pages, with visible
                        coverage and collection status.
                      </p>
                    </div>
                  </div>
                  {!identity && (
                    <div className="banner">
                      <LockKeyhole size={18} />
                      <span>
                        Sign in to see live collection status and your
                        workspace’s source subscriptions.
                      </span>
                      <Button
                        onClick={() => {
                          setCreating(false);
                          setLogin(true);
                        }}
                      >
                        Sign in
                      </Button>
                    </div>
                  )}
                  <Sources packs={packs} />
                </>
              )}
              {view === 'team' &&
                (identity ? (
                  <Team
                    canEdit={canEdit}
                    busy={busy}
                    run={run}
                    identity={identity}
                    notify={setNotice}
                  />
                ) : (
                  <Empty title="A workspace for your team" icon={Users}>
                    Sign in to see your organization and collaborate on shared
                    dossiers.{' '}
                    <Button
                      onClick={() => {
                        setCreating(false);
                        setLogin(true);
                      }}
                    >
                      Sign in
                    </Button>
                  </Empty>
                ))}
            </>
          )}
        </main>
      </SidebarInset>
      <Auth
        open={login}
        onClose={() => {
          setLogin(false);
          setSeed(null);
        }}
        onSuccess={async (s: Identity) => {
          setIdentity(s);
          await refresh();
          setLogin(false);
          const target = readDossierLink(window.location.search);
          if (target)
            await openDossier(
              target.id,
              target.questionId,
              target.referenceId,
              false,
            );
          else
            setView(
              creating && s.role === 'organization_admin'
                ? 'wizard'
                : 'research',
            );
        }}
      />
    </SidebarProvider>
  );
}

function Auth({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (s: Identity) => Promise<void>;
}) {
  const [mode, setMode] = useState('login'),
    [form, setForm] = useState({
      name: '',
      organization_name: '',
      email: '',
      password: '',
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'reset') {
        await api('/auth/password-reset/request', { email: form.email });
        setError('If this account exists, a reset message has been requested.');
        return;
      }
      const body =
        mode === 'login'
          ? { email: form.email, password: form.password }
          : { ...form, locale: 'en-CH' };
      const result = await api<Identity>(
        '/auth/' + (mode === 'login' ? 'login' : 'register'),
        body,
      );
      setForm({ ...form, password: '' });
      await onSuccess(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="auth-dialog">
        <DialogHeader>
          <DialogTitle>
            {mode === 'register'
              ? 'Create your workspace'
              : mode === 'reset'
                ? 'Reset your password'
                : 'Welcome to HelveticLens'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'register'
              ? 'Registration creates a private organization. Invite colleagues once you are signed in.'
              : 'Use your existing HelveticLens account. Your workspace permissions apply here.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-stack">
          {mode === 'register' && (
            <>
              <Field label="Your name">
                <Input
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Organization">
                <Input
                  autoComplete="organization"
                  value={form.organization_name}
                  onChange={(e) =>
                    setForm({ ...form, organization_name: e.target.value })
                  }
                />
              </Field>
            </>
          )}
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          {mode !== 'reset' && (
            <Field
              label="Password"
              hint={
                mode === 'register' ? 'Use at least 12 characters.' : undefined
              }
            >
              <Input
                type="password"
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                minLength={mode === 'register' ? 12 : 1}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <Button type="submit" className="primary-cta" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : null}
            {mode === 'register'
              ? 'Create account'
              : mode === 'reset'
                ? 'Request reset email'
                : 'Sign in'}
          </Button>
          <div className="auth-links">
            <Button
              variant="link"
              onClick={() => {
                setError('');
                setMode(mode === 'register' ? 'login' : 'register');
              }}
            >
              {mode === 'register'
                ? 'Already have an account?'
                : 'Create an account'}
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setError('');
                setMode(mode === 'reset' ? 'login' : 'reset');
              }}
            >
              {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Team({
  canEdit,
  busy,
  run,
  identity,
  notify,
}: {
  canEdit: boolean;
  busy: string;
  run: Run;
  identity: Identity;
  notify: (message: string) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]),
    [email, setEmail] = useState(''),
    [role, setRole] = useState('viewer'),
    [invite, setInvite] = useState<Invitation | null>(null),
    [failure, setFailure] = useState('');
  useEffect(() => {
    let disposed = false;
    void api<Member[]>('/organization/members')
      .then((data) => {
        if (!disposed) setMembers(data);
      })
      .catch((e) => {
        if (!disposed) setFailure((e as Error).message);
      });
    return () => {
      disposed = true;
    };
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SHARED CONTEXT, CLEAR RESPONSIBILITY</div>
          <h1>Your team.</h1>
          <p>
            {identity.organization.name}. Activated dossiers are shared with
            members of this organization. Drafts remain private to their author.
          </p>
        </div>
      </div>
      {failure && (
        <div role="alert" className="banner error">
          {failure}
        </div>
      )}
      <div className="team-grid">
        <section className="surface">
          <h2>Workspace members</h2>
          {members.map((m) => (
            <div className="member-row" key={m.id || m.user.id}>
              <span className="avatar">
                {(m.user.name || m.user.email || '?').slice(0, 2).toUpperCase()}
              </span>
              <div>
                <b>{m.user.name || m.user.email}</b>
                <p>{m.user.email}</p>
              </div>
              <span className="tag">
                {m.role === 'organization_admin' ? 'Administrator' : 'Viewer'}
              </span>
            </div>
          ))}
          <p className="muted">
            Administrators create monitoring and edit dossiers. Viewers can read
            shared evidence and download files.
          </p>
          <a
            className="source-link"
            href="https://helveticlens.ch/organization"
            target="_blank"
            rel="noreferrer"
          >
            Manage roles in the platform <ArrowUpRight size={15} />
          </a>
        </section>
        <section className="surface">
          <h2>Invite a colleague</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run('Creating invitation', async () => {
                const v = await api<Invitation>('/organization/invitations', {
                  email,
                  role,
                });
                setInvite({
                  ...v,
                  url: `https://helveticlens.ch/login?invite=${encodeURIComponent(v.token)}&locale=en-CH`,
                });
                notify(
                  'Invitation created. Share the invitation link with this colleague.',
                );
                setEmail('');
              });
            }}
          >
            <Field label="Colleague's email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canEdit}
                required
              />
            </Field>
            <div className="role-options">
              <Button
                type="button"
                variant={role === 'viewer' ? 'secondary' : 'outline'}
                onClick={() => setRole('viewer')}
              >
                Viewer
              </Button>
              <Button
                type="button"
                variant={
                  role === 'organization_admin' ? 'secondary' : 'outline'
                }
                onClick={() => setRole('organization_admin')}
              >
                Administrator
              </Button>
            </div>
            <p className="muted">
              Administrator access includes monitoring, source settings and
              organization management.
            </p>
            <Button type="submit" disabled={!canEdit || !!busy}>
              <Plus size={16} />
              Create invitation
            </Button>
          </form>
          {invite && (
            <div className="invitation-result">
              <b>Invitation for {invite.email}</b>
              <p>
                {invite.invitation_url ||
                  invite.url ||
                  invite.accept_url ||
                  'The invitation is saved. Open organization management to copy the invitation link.'}
              </p>
              <a
                href="https://helveticlens.ch/organization"
                target="_blank"
                rel="noreferrer"
              >
                Open organization management
              </a>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
