import type { Localized } from './contracts';
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
function unavailable(read: boolean) {
  return read
    ? 'The platform is temporarily unavailable. Try loading again shortly.'
    : 'The platform is temporarily unavailable. Check the saved status before repeating this action.';
}
function fallbackMessage(status: number, read: boolean) {
  if (status >= 500) return unavailable(read);
  if (status === 401)
    return 'Your session has expired. Sign in again to continue.';
  if (status === 403)
    return 'You no longer have access to this information. Reopen the dossier to check your access.';
  if (status === 404)
    return 'This saved item could not be found. Reload the dossier to see what is available.';
  if (status === 408)
    return 'The request timed out. Check the saved status before trying again.';
  if (status === 429)
    return 'Too many requests. Wait a moment before trying again.';
  return 'The request could not be completed. Please retry.';
}
export async function api<T = unknown>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  const verb = method || (body === undefined ? 'GET' : 'POST');
  const read = verb === 'GET' || verb === 'HEAD';
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData))
    headers['Content-Type'] = 'application/json';
  if (verb !== 'GET') {
    const csrf = document.cookie
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('helvetic_lens_csrf='))
      ?.slice('helvetic_lens_csrf='.length);
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  }
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method: verb,
      headers,
      body:
        body instanceof FormData
          ? body
          : body !== undefined
            ? JSON.stringify(body)
            : undefined,
      cache: 'no-store',
      signal,
    });
  } catch (failure) {
    if (
      signal?.aborted ||
      (failure instanceof Error && failure.name === 'AbortError')
    )
      throw failure;
    throw new ApiError(
      read
        ? 'Could not connect to the platform. Check your connection and try loading again.'
        : 'The connection was interrupted. Check the saved status before repeating this action.',
      null,
    );
  }
  if (response.status === 204 || (read && verb === 'HEAD' && response.ok))
    return null as T;
  let malformed = false;
  const data: unknown = await response.json().catch(() => {
    malformed = true;
    return null;
  });
  if (!response.ok) {
    const detail = record(data) ? data.detail : null;
    throw new ApiError(
      response.status >= 500
        ? unavailable(read)
        : typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail
                .map((x) =>
                  record(x) && typeof x.msg === 'string'
                    ? x.msg
                    : 'Invalid input',
                )
                .join('; ')
            : fallbackMessage(response.status, read),
      response.status,
    );
  }
  if (malformed)
    throw new ApiError(
      'The platform returned an unreadable response. Reload the saved information before trying again.',
      response.status,
    );
  return data as T;
}
export const uid = () => crypto.randomUUID();
export function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-CH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Zurich',
      }).format(new Date(value))
    : 'Not checked yet';
}
export function text(value: Localized | string | null | undefined): string {
  return typeof value === 'string'
    ? value
    : value?.['en-CH'] || value?.en || Object.values(value || {})[0] || '';
}
