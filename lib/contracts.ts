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
export interface EntryData {
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
    | 'monitor';
  title: string;
  body: string;
  url: string;
  data: EntryData;
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
}
export interface DossierRecord {
  id: string;
  product: string;
  created_at: string;
  profile: Profile;
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
  reasons: { matched_concepts?: string[] };
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
  canEdit: boolean;
  busy: string;
  run: Run;
  onBack: () => void;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}
