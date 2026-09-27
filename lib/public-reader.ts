import { cache } from 'react';
import { product } from './product';
import type { PublicDossier, PublicPage } from './publication';

const CORE = process.env.HELVETICLENS_API_ORIGIN || 'https://helveticlens.ch';
export type PublicResult<T> =
  | { data: T; error?: never; missing?: never }
  | { data?: never; error: string; missing: boolean };

async function read<T>(path: string): Promise<PublicResult<T>> {
  try {
    const response = await fetch(
      `${CORE}/api/products/${product.id}/public-dossiers${path}`,
      {
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
        headers: { accept: 'application/json' },
      },
    );
    if (!response.ok)
      return {
        error:
          response.status === 404
            ? 'This public dossier is unavailable. Its author may have withdrawn it.'
            : 'Public dossiers could not be loaded. Please retry.',
        missing: response.status === 404,
      };
    return { data: (await response.json()) as T };
  } catch (error) {
    console.error('Public dossier reader fetch failed:', error instanceof Error ? error.name : 'Unknown error');
    return {
      error: 'Public dossiers could not be loaded. Please retry.',
      missing: false,
    };
  }
}
// Per-render memoization; no identity cookies, private API routes or persistent cache.
export const readPublicDossier = cache((id: string) =>
  /^[0-9a-f-]{36}$/.test(id)
    ? read<PublicDossier>(`/${encodeURIComponent(id)}`)
    : Promise.resolve<PublicResult<PublicDossier>>({
        error: 'Dossier unavailable.',
        missing: true,
      }),
);
export function readPublicPage(query: string, offset: number) {
  return read<PublicPage>(
    `?${new URLSearchParams({ q: query, offset: String(offset) })}`,
  );
}
