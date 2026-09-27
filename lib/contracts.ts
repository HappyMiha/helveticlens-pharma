import type { LucideIcon } from 'lucide-react';
export type Localized = Record<string, string>;
export interface Identity {
  authenticated: boolean;
  role: 'organization_admin' | 'viewer';
  user: { id: string; name: string; email: string; email_verified: boolean };
  organization: { id: string; name: string };
}
export interface TopicCard {
  id: string;
  selected: boolean;
  name: string;
  description: string;
  keywords: string[];
  reference_note?: string;
}
export interface Suggestion {
  name: string;
  description: string;
  keywords: string[];
}
export interface SourceRequest {
  id: string;
  label: string;
  url: string;
  kind: 'binding' | 'pending' | 'signals';
  status: 'requested';
}
export interface ProfileConfig {
  audience: 'client' | 'organization';
  name: string;
  sector: string;
  goal: string;
  feedback: string;
  requested_jurisdictions: string;
  topics: TopicCard[];
  source_pack_ids: string[];
  source_requests: SourceRequest[];
  delivery: 'keep' | 'daily' | 'weekly' | 'off';
  delivery_consent: boolean;
}
export interface TopicPlan {
  name: string;
  goal: string;
  concepts: string[];
  exclusions: string[];
  revision: number;
  created_at: string;
}
export interface Topic {
  id: string;
  current_revision: number;
  plan: TopicPlan;
  revisions: TopicPlan[];
}
export interface Profile {
  id: string;
  revision: number;
  status: 'draft' | 'active' | 'paused';
  step: number;
  config: ProfileConfig;
  topic_ids: string[];
  topics: Topic[];
  created_at: string;
  updated_at: string;
}
export interface DiscoveryProvenance {
  provider: 'fedlex' | 'europepmc';
  query: string;
  retrieved_at: string;
  page_number: number;
  record: Omit<SearchHit, 'discovery_receipt' | 'dossier_id' | 'thread_id'>;
}
export interface EntryData {
  discovery?: DiscoveryProvenance;
  relevance?: string;
  law_id?: string;
  topics?: Suggestion[];
  topic_revisions?: Record<string, number>;
  provider?: string;
  model?: string;
  feedback_ids?: string[];
  proposal_id?: string;
  topic_id?: string;
  revision?: number;
  suggestion?: number;
  input_revision?: number;
  findings?: {
    claim: string;
    citations: { source_id: string; quote: string }[];
  }[];
  unknowns?: string[];
  search_queries?: string[];
  sources?: {
    id: string;
    key: string;
    kind: string;
    title: string;
    text: string;
    url: string;
    date: string;
    sha256: string;
  }[];
}
export interface Entry {
  id: string;
  kind:
    | 'note'
    | 'reference'
    | 'file'
    | 'feedback'
    | 'proposal'
    | 'improvement'
    | 'monitor'
    | 'context'
    | 'review'
    | 'action'
    | 'question'
    | 'discussion'
    | 'research'
    | 'saved_search';
  title: string;
  body: string;
  url: string;
  data: EntryData;
  thread_id?: string | null;
  byte_size: number;
  sha256: string;
  author: string;
  created_at: string;
}
export interface DocumentWatch {
  id: string;
  name: string;
  url: string;
  last_checked: string | null;
  last_result: string;
  auto_check_enabled: boolean;
  active: boolean;
  last_success_at?: string | null;
  last_error?: string;
  next_check_at?: string | null;
  schedule?:
    | 'paused'
    | 'manual'
    | 'needs_operator'
    | 'unscheduled'
    | 'due'
    | 'scheduled';
  stale?: boolean;
  synthetic?: boolean;
  saved_version_at?: string | null;
  active_scan?: { id: string; status: string; stage: string } | null;
  checked_at?: string;
}
export interface DossierRecord {
  id: string;
  product: string;
  created_at: string;
  profile: Profile;
  work: DossierWork;
  discussion: { questions: number; open_questions: number };
  activity_at: string;
  entries: Entry[];
  entry_count: number;
  documents: DocumentWatch[];
}
export interface DossiersPage {
  items: DossierRecord[];
  total: number;
}
export interface SourcePack {
  id: string;
  name: Localized;
  description: Localized;
  last_success_at: string | null;
  partial: boolean;
  known_gaps: string[];
}
export interface SourceCatalogue {
  items: SourcePack[];
}
export interface ProfilesPage {
  email_available: boolean;
}
export interface TopicSuggestions {
  profile: Profile;
  suggestions: TopicCard[];
  provider: string;
  model: string;
}
export interface SourceAdvice {
  recommendations: { source_id: string; reason: string }[];
  provider: string;
  model: string;
}
export interface Match {
  id: string;
  event_id: string;
  is_current: boolean;
  evaluation_fingerprint: string | null;
  validity: string;
  matched_at: string;
  evidence: {
    source_url?: string;
    title?: string;
    work_title?: string;
    event_title?: string;
    summary?: string;
    authority?: string;
    event_kind?: string;
  };
  reasons: {
    type: string;
    value?: string;
    values?: string[];
    tokens?: string[];
  }[];
}
export interface Preview {
  topics: {
    id: string;
    name: string;
    items: { title?: string; summary?: string; event?: { title?: string } }[];
  }[];
}
export interface Member {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
}
export interface Invitation {
  id: string;
  email: string;
  token: string;
  url?: string;
  invitation_url?: string;
  accept_url?: string;
}
export interface Preset {
  name: string;
  goal: string;
  sector: string;
  source_requests?: SourceRequest[];
}
export type Run = (label: string, fn: () => Promise<void>) => Promise<void>;
export type NavigationItem = [string, string, LucideIcon];
export interface WizardProps {
  initial: DossierRecord | null;
  seed: Preset | null;
  packs: SourcePack[];
  emailAvailable: boolean;
  identity: Identity;
  busy: string;
  run: Run;
  onCancel: () => void;
  onSaved: (d: DossierRecord) => Promise<void>;
  onActivated: (id: string) => Promise<void>;
}
export interface DossierProps {
  dossier: DossierRecord;
  initialQuestionId?: string | null;
  canEdit: boolean;
  busy: string;
  run: Run;
  onBack: () => void;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}

export type Priority = 'normal' | 'high' | 'urgent';
export type ActionStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export interface DossierContext {
  subject: string;
  reference: string;
  jurisdictions: string;
  category: string;
}
export interface Person {
  id: string;
  name: string;
}
export interface DossierWork {
  revision: number;
  context: DossierContext;
  priority: Priority;
  owner: Person | null;
  next_review_on: string | null;
  last_reviewed_at: string | null;
  review_due: boolean;
}
export interface ResearchOriginRef {
  thread_id: string;
  entry_id?: string;
  gap_index?: number;
}
export interface ResearchActionSeed {
  origin: ResearchOriginRef;
  question: string;
  context: string;
  gap?: string;
}
export interface ResearchOriginSnapshot extends ResearchOriginRef {
  question: string;
  captured_at: string;
  gap?: string;
}
export interface WorkAction {
  id: string;
  dossier_id: string;
  revision: number;
  title: string;
  detail: string;
  status: ActionStatus;
  priority: Priority;
  assignee: Person | null;
  due_on: string | null;
  overdue: boolean;
  source_url: string;
  evidence: {
    match_id?: string;
    evaluation_fingerprint?: string;
    captured_at?: string;
    research?: ResearchOriginSnapshot;
  };
  outcome: string;
  created_at: string;
  updated_at: string;
  dossier_name?: string;
  subject?: string;
}
export interface ActionsPage {
  items: WorkAction[];
  total: number;
}
export interface WorkbenchPage extends ActionsPage {
  today: string;
  scope: 'all' | 'mine';
  counts: {
    open: number;
    overdue: number;
    unassigned: number;
    completed_week: number;
    reviews_due: number;
  };
  reviews: { id: string; name: string; work: DossierWork }[];
}

export interface ResearchThread {
  id: string;
  dossier_id: string;
  revision: number;
  title: string;
  body: string;
  author: string;
  accepted_entry_id: string | null;
  accepted_at: string | null;
  reply_count: number;
  created_at: string;
  updated_at: string;
}
export interface ThreadPage {
  items: ResearchThread[];
  total: number;
}
export interface ThreadDetail extends ResearchThread {
  answer_needs_review: boolean;
  replies: Entry[];
  accepted: Entry | null;
}
export interface SearchHit {
  discovery_receipt?: string;
  id: string;
  kind: string;
  provider: string;
  title: string;
  summary: string;
  url: string;
  date: string | null;
  dossier_id?: string;
  thread_id?: string | null;
}
export interface SearchRecipe {
  query: string;
  provider: 'workspace' | 'fedlex' | 'europepmc';
  match_mode?: 'all' | 'phrase' | null;
}
export interface SavedSearch {
  id: string;
  body: string;
  author: string;
  created_at: string;
  data: SearchRecipe;
}
export interface SavedSearchInput extends SearchRecipe {
  request_key: string;
  purpose: string;
}
export interface DiscoveryResult extends SearchRecipe {
  items: SearchHit[];
  checked_at: string;
  coverage: string;
  total?: number | null;
  next_cursor?: string | null;
  page_number?: number;
  page_size?: number;
  omitted_records?: number;
  limit_reached?: boolean;
  continuation_unavailable?: boolean;
}
export interface SearchAngle {
  label: string;
  reason: string;
  provider: 'workspace' | 'fedlex' | 'europepmc';
  query: string;
}
export interface SearchPlan {
  question: string;
  angles: SearchAngle[];
  clarifications: string[];
  generated_at: string;
  model_provider: string;
  model: string;
}
