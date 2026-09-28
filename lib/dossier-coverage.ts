import type { DocumentWatch, Localized } from './contracts';

export type CoverageStream = {
  connector: string;
  stream: string;
  publisher: string;
  catalogue_state: string;
  known_gaps: string[];
  configured: boolean;
  enabled: boolean;
  next_attempt_past_due: boolean;
  last_reported_health: string;
  last_run_status: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  next_run_at: string | null;
};
export type CoveragePack = {
  id: string;
  name: Localized;
  definition_state: string;
  subscription_enabled: boolean;
  subscription_state: string;
  streams: CoverageStream[];
  unsupported_streams: { connector: string; stream: string }[];
};
export type DossierCoverage = {
  schema_id: 'dossier-coverage/v1';
  dossier_id: string;
  captured_at: string;
  profile_status: string;
  scope: 'saved_operational_state';
  documents: DocumentWatch[];
  topics: {
    id: string;
    name: string;
    status: string;
    revision: number | null;
    pack_ids: string[];
  }[];
  packs: CoveragePack[];
  web_research: {
    enabled: boolean;
    revision: number;
    last_scheduler_check_at: string | null;
    next_run_at: string | null;
    reason: string;
    latest_run: {
      id: string;
      status: string;
      policy_revision: number;
      created_at: string;
    } | null;
  };
  limitations: string[];
};

export type CoverageStatus = { label: string; attention: boolean };
const state = (label: string, attention = true): CoverageStatus => ({
  label,
  attention,
});

export function pageCoverage(page: DocumentWatch): CoverageStatus {
  if (page.synthetic) return state('Example data · live check not established');
  if (page.last_result === 'failed') return state('Last check failed');
  if (!page.active) return state('Paused');
  if (page.active_scan) return state('Check in progress');
  if (page.stale) return state('Last success is over 48 hours old');
  if (!page.last_success_at) return state('No successful check recorded');
  if (page.schedule === 'needs_operator')
    return state('Needs a workspace operator');
  if (page.schedule === 'unscheduled') return state('Next check not scheduled');
  if (!page.auto_check_enabled) return state('Manual checks only');
  return state('Successful check recorded', false);
}

export function packCoverage(pack: CoveragePack): CoverageStatus {
  if (pack.definition_state === 'missing')
    return state('No longer in the catalogue');
  if (pack.definition_state !== 'active')
    return state('Catalogue entry inactive');
  if (!pack.subscription_enabled)
    return state('Not connected to this workspace');
  if (pack.subscription_state !== 'active')
    return state('Connection needs attention');
  if (pack.unsupported_streams.length)
    return state('Includes unsupported sources');
  if (!pack.streams.length) return state('No source streams recorded');
  if (pack.streams.some((stream) => streamCoverage(stream).attention))
    return state('Some checks need attention');
  return state('Saved successful checks', false);
}

export function streamCoverage(stream: CoverageStream): CoverageStatus {
  if (!stream.configured) return state('Not scheduled');
  if (!stream.enabled)
    return state(
      stream.last_run_status === 'failed' ||
        stream.last_reported_health === 'error'
        ? 'Collection paused · last attempt failed'
        : 'Collection paused',
    );
  if (
    stream.last_run_status === 'failed' ||
    stream.last_reported_health === 'error'
  )
    return state('Last collection failed');
  if (
    stream.last_run_status === 'partial' ||
    stream.last_reported_health === 'degraded'
  )
    return state('Collection incomplete');
  if (
    stream.last_run_status === 'running' ||
    stream.last_run_status === 'queued'
  )
    return state('Collection pending');
  if (stream.next_attempt_past_due) return state('Next collection is overdue');
  if (!stream.last_success_at)
    return state('No successful collection recorded');
  if (stream.catalogue_state !== 'available')
    return state('Source capability partly verified');
  if (stream.last_reported_health !== 'healthy')
    return state('Current health not established');
  return state('Successful collection recorded', false);
}
