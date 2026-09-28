import type { Localized } from './contracts';
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export async function api<T = unknown>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  const verb = method || (body === undefined ? 'GET' : 'POST');
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
  const response = await fetch('/api' + path, {
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
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = record(data) ? data.detail : null;
    throw new Error(
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail
              .map((x) =>
                record(x) && typeof x.msg === 'string'
                  ? x.msg
                  : 'Invalid input',
              )
              .join('; ')
          : 'The request could not be completed. Please retry.',
    );
  }
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
