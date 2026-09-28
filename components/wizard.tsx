'use client';
import { ResearchStart } from './research-start';
import { TemplatePicker, TemplateGuidance } from './dossier-template';
import {
  templateReference,
  templateStarter,
  type DossierTemplate,
} from '@/lib/dossier-templates';
import { PublicCopyOrigin } from './public-origin';
import { DomainContext } from './domain-context';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  FileCheck,
  Globe,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  DossierRecord,
  Entry,
  Preview,
  Profile,
  ProfileConfig,
  SourceAdvice,
  TopicCard,
  TopicSuggestions,
  WizardProps,
} from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { api, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { emptyConfig, Field, ROOT, Sources } from './workspace';

const STEPS = [
  'Your question',
  'Topics & AI',
  'Sources',
  'Delivery',
  'Review & start',
];
export function Wizard({
  initial,
  seed,
  packs,
  emailAvailable,
  identity,
  busy,
  run,
  onCancel,
  onSaved,
  onActivated,
  onOpenDraft,
}: WizardProps) {
  const [mode, setMode] = useState<'research' | 'monitoring'>(
    initial || seed ? 'monitoring' : 'research',
  );
  const [doc, setDoc] = useState<DossierRecord | null>(initial),
    [config, setConfig] = useState<ProfileConfig>(
      initial?.profile.config || { ...emptyConfig(), ...seed },
    ),
    [step, setStep] = useState(initial?.profile.step || 0),
    [creationKey] = useState(uid),
    [dirty, setDirty] = useState(false),
    [suggestions, setSuggestions] = useState<TopicCard[]>([]),
    [model, setModel] = useState(''),
    [preview, setPreview] = useState<Preview | null>(null),
    [sourceUrl, setSourceUrl] = useState(''),
    [sourceName, setSourceName] = useState(''),
    [sourceAdvice, setSourceAdvice] = useState<SourceAdvice | null>(null);
  const [template, setTemplate] = useState<DossierTemplate | null>(null);
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [monitoringAudience, setMonitoringAudience] = useState<
    'team' | 'workspace'
  >(initial?.access?.audience === 'workspace' ? 'workspace' : 'team');
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty]);
  function change(values: Partial<ProfileConfig>) {
    setConfig((c: ProfileConfig) => ({ ...c, ...values }));
    setDirty(true);
    setPreview(null);
  }
  async function save(next = step) {
    const clean = {
      ...config,
      topics: config.topics.map((t: TopicCard) => ({
        ...t,
        keywords: t.keywords.map((k: string) => k.trim()).filter(Boolean),
      })),
    };
    let d = doc;
    if (!d) {
      d = await api<DossierRecord>(ROOT, {
        creation_key: creationKey,
        template: templateReference(template),
        config: clean,
        step: next,
      });
      setDoc(d);
    } else {
      const p = await api<Profile>(
        `/monitoring-profiles/${d.profile.id}`,
        { expected_revision: d.profile.revision, config: clean, step: next },
        'PUT',
      );
      d = { ...d, profile: p };
      setDoc(d);
    }
    setStep(next);
    setDirty(false);
    window.history.replaceState({}, '', `/?dossier=${d.id}`);
    await onSaved(d);
    return d;
  }
  function valid() {
    if (
      step === 0 &&
      (!config.name.trim() ||
        !config.sector.trim() ||
        config.goal.trim().length < 3)
    )
      throw new Error('Enter a dossier name, sector and monitoring question.');
    if (
      step === 1 &&
      !config.topics.some(
        (t: TopicCard) =>
          t.selected &&
          t.name.trim() &&
          t.description.trim() &&
          t.keywords.length,
      )
    )
      throw new Error('Add or accept at least one complete topic.');
    if (step === 2 && !config.source_pack_ids.length)
      throw new Error(
        'Choose at least one scheduled Swiss source collection. Additional page watches can be added alongside it.',
      );
    if (step === 3 && config.delivery !== 'keep' && !config.delivery_consent)
      throw new Error(
        'Confirm the change to your personal digest preferences.',
      );
  }
  function choosePack(id: string) {
    change({
      source_pack_ids: config.source_pack_ids.includes(id)
        ? config.source_pack_ids.filter((x: string) => x !== id)
        : [...config.source_pack_ids, id],
    });
  }
  function chooseExtra(id: string) {
    const p = product.recommended.find((x) => x.id === id)!;
    const exists = config.source_requests.find((x) => x.url === p.url);
    change({
      source_requests: exists
        ? config.source_requests.filter((x) => x.url !== p.url)
        : [
            ...config.source_requests,
            {
              id: uid(),
              label: p.name,
              url: p.url,
              kind: 'signals',
              status: 'requested',
            },
          ],
    });
  }
  function topic(i: number, values: Partial<TopicCard>) {
    change({
      topics: config.topics.map((t, n) => (n === i ? { ...t, ...values } : t)),
    });
  }
  async function suggest() {
    const d = await save();
    const result = await api<TopicSuggestions>(
      `/monitoring-profiles/${d.profile.id}/suggest`,
      {
        expected_revision: d.profile.revision,
        feedback: config.feedback,
        locale: 'en-CH',
      },
    );
    setDoc({ ...d, profile: result.profile });
    setConfig(result.profile.config);
    setSuggestions(result.suggestions);
    setModel(`${result.provider} · ${result.model}`);
    await onSaved({ ...d, profile: result.profile });
  }
  async function activate() {
    const d = await save(4);
    if (
      monitoringAudience === 'team' &&
      typeof d.access?.can_watch_pages !== 'boolean'
    ) {
      throw new Error(
        'Private monitoring needs a platform update. Refresh and try again.',
      );
    }
    if (monitoringAudience === 'team' && !d.access?.managed) {
      await api(`${ROOT}/${d.id}/team/enable`, {
        expected_revision: d.access?.revision ?? 1,
      });
    }
    const p = await api<Profile>(
      `/monitoring-profiles/${d.profile.id}/activate`,
      {
        expected_revision: d.profile.revision,
        share_with_workspace_confirmed: shareConfirmed,
        monitoring_audience: monitoringAudience,
      },
    );
    setDoc({ ...d, profile: p });
    for (const source of config.source_requests) {
      const entry = await api<Entry>(`${ROOT}/${d.id}/entries`, {
        request_key: source.id,
        kind: 'reference',
        title: source.label,
        body:
          monitoringAudience === 'team'
            ? 'Selected during monitoring setup. Source reference retained for private dossier research.'
            : 'Selected during monitoring setup. Individual page watch; website-wide coverage is not implied.',
        url: source.url,
      });
      if (monitoringAudience === 'team') continue;
      try {
        await api(`${ROOT}/${d.id}/sources/${entry.id}/monitor`, {});
      } catch (e) {
        await api(`${ROOT}/${d.id}/entries`, {
          request_key: uid(),
          kind: 'note',
          title: 'Source needs attention',
          body: `${source.label}: ${(e as Error).message}`,
          url: source.url,
        });
      }
    }
    await onActivated(d.id);
  }
  if (mode === 'research')
    return (
      <ResearchStart
        onCancel={onCancel}
        onMonitoring={() => setMode('monitoring')}
      />
    );
  return (
    <div className="wizard">
      <PublicCopyOrigin origin={doc?.public_origin} />
      <div className="wizard-top">
        <Button variant="ghost" disabled={!!busy} onClick={onCancel}>
          <ArrowLeft size={16} />
          All dossiers
        </Button>
        <span className="save-state">
          {dirty
            ? 'Unsaved changes'
            : doc
              ? 'Draft saved to your workspace'
              : 'New monitoring dossier'}
        </span>
        <Button
          variant="outline"
          disabled={!!busy}
          onClick={() => run('Saving draft', () => save().then(() => {}))}
        >
          <Save size={16} />
          Save draft
        </Button>
      </div>
      <div className="stepper" aria-label="Monitoring setup progress">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={
              i === step ? 'step current' : i < step ? 'step done' : 'step'
            }
            aria-current={i === step ? 'step' : undefined}
          >
            <span>{i < step ? <Check size={16} /> : i + 1}</span>
            <b>{label}</b>
          </div>
        ))}
      </div>
      <div className="wizard-layout">
        <section className="wizard-main">
          <div className="eyebrow">STEP {step + 1} OF 5</div>
          <h1>
            {
              [
                'What matters to you?',
                'Give your question focus.',
                'Choose where to look.',
                'Stay informed, your way.',
                'A clear scope. Ready to start.',
              ][step]
            }
          </h1>
          <p className="wizard-intro">
            {
              [
                'A few details help AI suggest useful monitoring topics.',
                'Accept AI suggestions or write your own. Every topic stays editable.',
                'Scheduled Swiss collections and individual primary-source page watches.',
                'In-app results are always available. Email uses your verified account and existing organization digest.',
                'Review the sources, delivery and audience. Start monitoring with the access you choose.',
              ][step]
            }
          </p>
          <DomainContext pack={doc?.profile.domain_pack} />
          {step === 0 && (
            <div className="form-stack">
              {!doc ? (
                <>
                  <TemplatePicker
                    value={template}
                    disabled={!!busy}
                    onChange={(value) => {
                      setTemplate(value);
                      setDirty(true);
                    }}
                  />
                  {template &&
                    (!config.goal.trim() || !config.sector.trim()) && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!!busy}
                        onClick={() =>
                          change(templateStarter(config, template))
                        }
                      >
                        Fill empty fields from template
                      </Button>
                    )}
                </>
              ) : doc.template?.selection ? (
                <TemplateGuidance value={doc.template.selection} />
              ) : null}
              <div className="field-pair">
                <Field label="Dossier name">
                  <Input
                    placeholder={
                      product.id === 'pharma'
                        ? 'e.g. GLP-1 portfolio · Switzerland'
                        : 'e.g. Acme AG · Employment law'
                    }
                    value={config.name}
                    maxLength={160}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </Field>
                <Field label="Sector / context">
                  <Input
                    value={config.sector}
                    maxLength={160}
                    onChange={(e) => change({ sector: e.target.value })}
                  />
                </Field>
              </div>
              <Field
                label="What do you want to monitor?"
                hint="Include the decisions you need to make, products or clients, and changes that would matter."
              >
                <Textarea
                  rows={6}
                  maxLength={3000}
                  value={config.goal}
                  onChange={(e) => change({ goal: e.target.value })}
                  placeholder="Describe the changes you need to know about…"
                />
              </Field>
              <Field
                label="Jurisdictions of interest"
                hint="Scheduled collections cover the Swiss jurisdictions shown in Sources. Other jurisdictions need specific page watches; they are not automatically covered."
              >
                <Input
                  value={config.requested_jurisdictions}
                  maxLength={240}
                  onChange={(e) =>
                    change({ requested_jurisdictions: e.target.value })
                  }
                />
              </Field>
              <RadioGroup
                className="audience-choices"
                value={config.audience}
                onValueChange={(v) =>
                  change({ audience: v as ProfileConfig['audience'] })
                }
              >
                <label htmlFor="audience-client">
                  <RadioGroupItem id="audience-client" value="client" />
                  For a client / product
                </label>
                <label htmlFor="audience-organization">
                  <RadioGroupItem
                    id="audience-organization"
                    value="organization"
                  />
                  For my organization
                </label>
              </RadioGroup>
            </div>
          )}
          {step === 1 && (
            <>
              <div className="ai-callout">
                <Sparkles size={24} />
                <div>
                  <h3>Build a useful watchlist together.</h3>
                  <p>
                    AI uses your question and the available source catalogue. It
                    proposes search interests, not legal or medical conclusions.
                  </p>
                  <Button
                    disabled={!!busy}
                    onClick={() =>
                      run('Asking your configured AI provider', suggest)
                    }
                  >
                    <Sparkles size={16} />
                    {suggestions.length
                      ? 'Refine suggestions'
                      : 'Suggest topics'}
                  </Button>
                </div>
              </div>
              <Field label="What should AI focus on or leave out?">
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={config.feedback}
                  onChange={(e) => change({ feedback: e.target.value })}
                  placeholder="e.g. Prioritise actionable safety updates; exclude financial news."
                />
              </Field>
              {suggestions.length > 0 && (
                <div className="suggestion-list">
                  <div className="section-label">AI suggestions · {model}</div>
                  {suggestions.map((s) => (
                    <div className="suggestion-card" key={s.id}>
                      <div>
                        <h3>{s.name}</h3>
                        <p>{s.description}</p>
                        <div className="chips">
                          {s.keywords.map((k: string) => (
                            <span key={k}>{k}</span>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        disabled={
                          config.topics.some((x: TopicCard) => x.id === s.id) ||
                          config.topics.length >= 6
                        }
                        onClick={() =>
                          change({ topics: [...config.topics, s] })
                        }
                      >
                        {config.topics.some((x: TopicCard) => x.id === s.id) ? (
                          <Check size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="section-header">
                <h2>Your topics</h2>
                <Button
                  variant="outline"
                  disabled={config.topics.length >= 6}
                  onClick={() =>
                    change({
                      topics: [
                        ...config.topics,
                        {
                          id: uid(),
                          selected: true,
                          name: '',
                          description: '',
                          keywords: [],
                          reference_note: '',
                        },
                      ],
                    })
                  }
                >
                  <Plus size={16} />
                  Add manually
                </Button>
              </div>
              {config.topics.map((t, i) => (
                <article className="topic-editor" key={t.id}>
                  <div className="topic-editor-head">
                    <Checkbox
                      aria-label={`Include topic ${i + 1}`}
                      checked={t.selected}
                      onCheckedChange={(v) => topic(i, { selected: v })}
                    />
                    <b>Topic {i + 1}</b>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove topic ${i + 1}`}
                      onClick={() =>
                        change({
                          topics: config.topics.filter(
                            (x: TopicCard) => x.id !== t.id,
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <Field label="Topic name">
                    <Input
                      value={t.name}
                      maxLength={240}
                      onChange={(e) => topic(i, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="What to look for">
                    <Textarea
                      rows={2}
                      value={t.description}
                      maxLength={2000}
                      onChange={(e) =>
                        topic(i, { description: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Keywords, separated by commas">
                    <Input
                      value={t.keywords.join(',')}
                      onChange={(e) =>
                        topic(i, {
                          keywords: e.target.value.split(',').slice(0, 20),
                        })
                      }
                    />
                  </Field>
                </article>
              ))}
              {!config.topics.length && (
                <p className="muted">
                  No topics selected yet. You can continue manually if the AI
                  provider is unavailable.
                </p>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <div className="ai-callout">
                <Sparkles size={22} />
                <div>
                  <h3>Ask AI where to look.</h3>
                  <p>
                    Recommendations are limited to the real source catalogue and
                    your saved monitoring goal.
                  </p>
                  <Button
                    disabled={!!busy}
                    onClick={() =>
                      run('Asking AI to recommend sources', async () => {
                        const d = await save();
                        setSourceAdvice(
                          await api<SourceAdvice>(
                            `${ROOT}/${d.id}/source-advice`,
                            { expected_revision: d.profile.revision },
                          ),
                        );
                      })
                    }
                  >
                    Recommend sources
                  </Button>
                </div>
              </div>
              {sourceAdvice && (
                <div className="suggestion-list">
                  {sourceAdvice.recommendations.map((a) => (
                    <div className="suggestion-card" key={a.source_id}>
                      <div>
                        <h3>
                          {packs.find((p) => p.id === a.source_id)?.name?.[
                            'en-CH'
                          ] || a.source_id}
                        </h3>
                        <p>{a.reason}</p>
                      </div>
                      <Button
                        variant="outline"
                        disabled={config.source_pack_ids.includes(a.source_id)}
                        onClick={() => choosePack(a.source_id)}
                      >
                        {config.source_pack_ids.includes(a.source_id)
                          ? 'Selected'
                          : 'Choose'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Sources
                packs={packs}
                selection={config.source_pack_ids}
                onToggle={choosePack}
                extraSelection={product.recommended
                  .filter((x) =>
                    config.source_requests.some((r) => r.url === x.url),
                  )
                  .map((x) => x.id)}
                onExtraToggle={chooseExtra}
              />
              <div className="surface custom-source">
                <h3>Add a source page</h3>
                <div className="field-pair">
                  <Field label="Source label">
                    <Input
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      maxLength={160}
                      placeholder="e.g. Swissmedic guidance"
                    />
                  </Field>
                  <Field label="HTTPS URL">
                    <Input
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </Field>
                </div>
                <Button
                  variant="outline"
                  disabled={
                    !sourceName ||
                    !sourceUrl ||
                    config.source_requests.length >= 10
                  }
                  onClick={() => {
                    change({
                      source_requests: [
                        ...config.source_requests,
                        {
                          id: uid(),
                          label: sourceName,
                          url: sourceUrl,
                          kind: 'signals',
                          status: 'requested',
                        },
                      ],
                    });
                    setSourceName('');
                    setSourceUrl('');
                  }}
                >
                  <Plus size={16} />
                  Add source page
                </Button>
              </div>
              {config.source_requests.length > 0 && (
                <div className="selected-pages">
                  <h3>Selected pages · {config.source_requests.length}</h3>
                  {config.source_requests.map((s) => (
                    <div key={s.id}>
                      <span>
                        {s.label}
                        <small>{s.url}</small>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${s.label}`}
                        onClick={() =>
                          change({
                            source_requests: config.source_requests.filter(
                              (x) => x.id !== s.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <div className="delivery-inapp">
                <Bell size={23} />
                <div>
                  <h3>In your dossier</h3>
                  <p>
                    Matched evidence, changes and your team’s context are
                    available whenever you open the workspace.
                  </p>
                </div>
                <span className="tag good">Always on</span>
              </div>
              <RadioGroup
                value={config.delivery}
                onValueChange={(v) =>
                  change({
                    delivery: v as ProfileConfig['delivery'],
                    delivery_consent: false,
                  })
                }
                className="delivery-options"
              >
                {[
                  [
                    'keep',
                    'Keep my current email settings',
                    'Use the existing personal organization digest.',
                  ],
                  [
                    'daily',
                    'Daily email digest',
                    'A daily summary of relevant developments.',
                  ],
                  [
                    'weekly',
                    'Weekly email digest',
                    'A weekly review of monitored changes.',
                  ],
                  [
                    'off',
                    'Turn off my email digest',
                    'Keep monitoring in the app.',
                  ],
                ].map(([value, label, description]) => (
                  <label
                    htmlFor={`delivery-${value}`}
                    className={`delivery-choice ${config.delivery === value ? 'selected' : ''}`}
                    key={value}
                  >
                    <RadioGroupItem
                      id={`delivery-${value}`}
                      value={value}
                      disabled={
                        !emailAvailable && ['daily', 'weekly'].includes(value)
                      }
                    />
                    <span>
                      <b>{label}</b>
                      <small>{description}</small>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {!emailAvailable && (
                <div className="banner">
                  <ShieldCheck size={18} />
                  <span>
                    Email requires a verified address and an available mail
                    service. You can start with in-app monitoring.
                  </span>
                </div>
              )}
              {!identity.user.email_verified && (
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    run('Requesting verification email', async () => {
                      await api('/auth/email-verification/request', {
                        email: identity.user.email,
                      });
                    })
                  }
                >
                  Request verification email
                </Button>
              )}
              {config.delivery !== 'keep' && (
                <label htmlFor="delivery-consent" className="check-line">
                  <Checkbox
                    id="delivery-consent"
                    checked={config.delivery_consent}
                    onCheckedChange={(v) => change({ delivery_consent: v })}
                  />
                  <span>
                    Apply this change to my personal digest for this
                    organization. It affects my other monitoring in this
                    workspace too.
                  </span>
                </label>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <div className="review-summary">
                <FileCheck size={26} />
                <h2>{config.name}</h2>
                <p>{config.goal}</p>
                <div className="review-metrics">
                  <div>
                    <b>
                      {
                        config.topics.filter((x: TopicCard) => x.selected)
                          .length
                      }
                    </b>
                    Topics
                  </div>
                  <div>
                    <b>{config.source_pack_ids.length}</b>Swiss collections
                  </div>
                  <div>
                    <b>{config.source_requests.length}</b>
                    {monitoringAudience === 'team'
                      ? 'Research references'
                      : 'Page watches to connect'}
                  </div>
                </div>
              </div>
              <div className="review-list">
                {config.topics
                  .filter((x: TopicCard) => x.selected)
                  .map((t: TopicCard) => (
                    <div key={t.id}>
                      <Check size={16} />
                      <span>
                        <b>{t.name}</b>
                        <small>{t.keywords.join(' · ')}</small>
                      </span>
                    </div>
                  ))}
              </div>
              <p className="muted">
                AI proposals and comments remain distinct from primary-source
                evidence. Monitoring follows your selected source feeds and
                topic rules. The audience below controls who can read those
                results.
              </p>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  run('Checking existing evidence', async () => {
                    const d = await save();
                    setPreview(
                      await api<Preview>(
                        `/monitoring-profiles/${d.profile.id}/preview`,
                        { expected_revision: d.profile.revision },
                      ),
                    );
                  })
                }
              >
                Preview existing matches
              </Button>
              {preview && (
                <div className="preview-results">
                  <h3>Existing evidence preview</h3>
                  {preview.topics.map((t) => (
                    <div key={t.id}>
                      <b>{t.name}</b>
                      <p>
                        {t.items?.length || 0} sample matches in the currently
                        saved corpus.
                      </p>
                      {t.items?.slice(0, 3).map((x, i) => (
                        <p key={i}>
                          {x.title ||
                            x.summary ||
                            x.event?.title ||
                            'Saved source event'}
                        </p>
                      ))}
                    </div>
                  ))}
                  <p className="muted">
                    This is a bounded sample of saved events. Zero matches does
                    not prove that no change exists.
                  </p>
                </div>
              )}
            </>
          )}
          {step === 4 && (
            <div className="team-activation">
              <h3>Who can read this monitoring?</h3>
              {monitoringAudience === 'team' &&
                typeof doc?.access?.can_watch_pages !== 'boolean' && (
                  <p role="alert">
                    Private monitoring needs a platform update. Refresh and try
                    again, or explicitly choose workspace sharing.
                  </p>
                )}
              <RadioGroup
                aria-label="Monitoring audience"
                disabled={!!busy || (!!doc && doc.profile.status !== 'draft')}
                value={monitoringAudience}
                onValueChange={(value) => {
                  setMonitoringAudience(value as 'team' | 'workspace');
                  setShareConfirmed(false);
                }}
              >
                <label htmlFor="monitoring-team">
                  <RadioGroupItem id="monitoring-team" value="team" />
                  Only my invited team
                </label>
                <label htmlFor="monitoring-workspace">
                  <RadioGroupItem id="monitoring-workspace" value="workspace" />
                  Everyone in this workspace
                </label>
              </RadioGroup>
              {monitoringAudience === 'workspace' ? (
                <label htmlFor="share-dossier-workspace">
                  <Checkbox
                    id="share-dossier-workspace"
                    checked={shareConfirmed}
                    onCheckedChange={(checked) =>
                      setShareConfirmed(checked === true)
                    }
                  />
                  Make this dossier and its monitoring visible to everyone in
                  this workspace.
                </label>
              ) : (
                <p className="source-meta">
                  Your dossier, topic matches and research stay private to
                  accepted members. Invite colleagues from Dossier team.
                  Selected page URLs are saved as private research references;
                  workspace page watches are unavailable in this mode.
                </p>
              )}
              <p className="source-meta">
                Starting monitoring requires the dossier owner and workspace
                administrator rights. The activation audience stays fixed;
                publishing a public snapshot is a separate owner action.
              </p>
            </div>
          )}
          <div className="wizard-footer">
            <Button
              variant="outline"
              disabled={step === 0 || !!busy}
              onClick={() =>
                run('Saving progress', () => save(step - 1).then(() => {}))
              }
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            <span>
              {step === 4
                ? 'You remain in control of the scope.'
                : 'Progress is saved when you continue.'}
            </span>
            {step < 4 ? (
              <Button
                className="primary-cta"
                disabled={!!busy}
                onClick={() =>
                  run('Saving progress', async () => {
                    valid();
                    await save(step + 1);
                  })
                }
              >
                Continue
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                className="primary-cta"
                disabled={
                  !!busy ||
                  (monitoringAudience === 'workspace' && !shareConfirmed) ||
                  (monitoringAudience === 'team' &&
                    typeof doc?.access?.can_watch_pages !== 'boolean') ||
                  (doc?.access
                    ? !doc.access.can_activate
                    : identity.role !== 'organization_admin')
                }
                onClick={() =>
                  run('Starting monitoring for the selected audience', activate)
                }
              >
                Start monitoring
                <ArrowRight size={16} />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={() =>
              void run('Saving research draft', async () => {
                valid();
                const saved = await save();
                await onOpenDraft(saved.id);
              })
            }
          >
            Save and open research dossier
          </Button>
        </section>
        <aside className="wizard-context">
          <div className="context-index">
            0{step + 1} <span>/ 05</span>
          </div>
          <h3>
            One question.
            <br />A living dossier.
          </h3>
          <p>
            Your dossier connects the monitoring scope with its primary sources,
            team notes, files and review history.
          </p>
          <div className="context-rule" />
          <ul>
            <li>
              <Globe size={17} />
              Traceable sources
            </li>
            <li>
              <ShieldCheck size={17} />
              Workspace permissions
            </li>
            <li>
              <Sparkles size={17} />
              Reviewed AI guidance
            </li>
          </ul>
          {config.name && (
            <div className="context-draft">
              <small>THIS DOSSIER</small>
              <b>{config.name}</b>
              <span>
                {config.topics.filter((x: TopicCard) => x.selected).length}{' '}
                selected topics
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
