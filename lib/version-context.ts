import { sourceReference } from './source-reading';

/** A fallback is a monitored page, never a claimed original capture URL. */
export function documentSourceLink(
  sourceUrl: string | null | undefined,
  documentUrl: string | null | undefined,
) {
  const recorded = !!sourceUrl;
  const reference = sourceReference(recorded ? sourceUrl : documentUrl, true);
  return reference ? { ...reference, recorded } : null;
}
