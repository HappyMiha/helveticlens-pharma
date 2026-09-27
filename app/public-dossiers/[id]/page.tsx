import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicContentView } from '@/components/public-content';
import { product } from '@/lib/product';
import { readPublicDossier } from '@/lib/public-reader';
import { publicHref } from '@/lib/publication';
import { date } from '@/lib/api';
import '../public.css';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await readPublicDossier(id);
  return result.data
    ? {
        title: `${result.data.title} · HelveticLens ${product.name}`,
        description: result.data.summary,
        alternates: { canonical: `https://${product.domain}${publicHref(id)}` },
      }
    : {
        title: 'Public dossier unavailable',
        robots: { index: false, follow: false },
      };
}
export default async function PublicDossierPage({ params }: Props) {
  const { id } = await params;
  const result = await readPublicDossier(id);
  if (result.missing) notFound();
  return (
    <main className="public-shell public-reader">
      <header className="public-header">
        <Link href="/public-dossiers">← Public dossiers · {product.name}</Link>
        <Link href="/">Open workspace</Link>
      </header>
      {result.data ? (
        <>
          <PublicContentView content={result.data} />
          <div className="public-meta">
            <span>First published {date(result.data.first_published_at)}</span>
            <span>Updated {date(result.data.updated_at)}</span>
            <span>Revision {result.data.revision}</span>
          </div>
          <aside className="public-reading-note">
            This is an author-published version. Publication does not certify
            its conclusions or the completeness of its sources.
          </aside>
        </>
      ) : (
        <div role="alert" className="public-empty">
          <h1>Unable to load this dossier</h1>
          <p>{result.error}</p>
          <a href={publicHref(id)}>Retry loading</a>
        </div>
      )}
    </main>
  );
}
