import { product } from './product';
// Server configuration only; never accept an upstream origin from browser input.
const CORE = process.env.HELVETICLENS_API_ORIGIN || 'https://helveticlens.ch';
const allowed =
  /^(auth\/(session(?:\/organization)?|login|logout|register|email-verification\/request|password-reset\/request)|source-packs|monitoring-profiles(?:\/[\w-]+(?:\/(suggest|preview|activate|status))?)?|monitoring-topics(?:\/[\w-]+(?:\/matches)?)?|organization\/(members|invitations)|laws(?:\/[\w-]+)?|scans(?:\/[\w-]+)?|digests\/preferences|connectors\/status)$/;
export async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join('/');
  if (
    !(
      allowed.test(route) ||
      new RegExp(
        `^products/${product.id}/(?:dossiers(?:/[a-zA-Z0-9_/-]+)?|workbench|discover)$`,
      ).test(route)
    )
  )
    return Response.json(
      { detail: 'This route is not available in this product.' },
      { status: 404 },
    );
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return Response.json(
        { detail: 'Open this action from your own workspace.' },
        { status: 403 },
      );
  }
  const headers = new Headers();
  for (const name of [
    'content-type',
    'accept',
    'accept-language',
    'x-csrf-token',
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const cookies = (request.headers.get('cookie') || '')
    .split(';')
    .map((x) => x.trim())
    .filter((x) => /^helvetic_lens_(session|csrf)=/.test(x))
    .join('; ');
  if (cookies) headers.set('cookie', cookies);
  let body: ArrayBuffer | undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (Number(request.headers.get('content-length')) > 11 * 1024 * 1024)
      return Response.json(
        { detail: 'Files must be at most 10 MB.' },
        { status: 413 },
      );
    const reader = request.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 11 * 1024 * 1024) {
          await reader.cancel();
          return Response.json(
            { detail: 'Files must be at most 10 MB.' },
            { status: 413 },
          );
        }
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      body = bytes.buffer;
    }
  }
  try {
    const upstream = await fetch(
      `${CORE}/api/${path.map(encodeURIComponent).join('/')}${new URL(request.url).search}`,
      {
        method: request.method,
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(115000),
      },
    );
    const output = new Headers({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    for (const name of [
      'content-type',
      'content-disposition',
      'content-security-policy',
      'referrer-policy',
      'retry-after',
      'x-request-id',
    ]) {
      const value = upstream.headers.get(name);
      if (value) output.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie())
      output.append('set-cookie', cookie);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: output,
    });
  } catch {
    return Response.json(
      {
        detail:
          'The HelveticLens platform is temporarily unavailable. Your saved work is safe; please retry.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
