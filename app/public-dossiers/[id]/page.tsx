import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicContentView } from '@/components/public-content';
import { PublicDossierActions } from '@/components/public-following';
import { PublicResearchView } from '@/components/public-research';
import { PublicDiscussion } from '@/components/public-discussion';
import { product } from '@/lib/product';
import {
  readPublicDossier,
  readPublicDiscussion,
  readPublicResearch,
  readPublicInvestigation,
} from '@/lib/public-reader';
import { publicHref } from '@/lib/publication';
import { date } from '@/lib/api';
import '../public.css';
import '@/app/investigation.css';

export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ research?: string }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await readPublicDossier(id);
  return result.data
    ? {
        title: `${result.data.title} · HelveticLens ${product.name}`,
        description: result.data.summary,
        alternates: {
          canonical: `https://${product.domain}${publicHref(result.data.slug || result.data.id)}`,
        },
      }
    : {
        title: 'Public dossier unavailable',
        robots: { index: false, follow: false },
      };
}
export default async function PublicDossierPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const result = await readPublicDossier(id);
  if (result.missing) notFound();
  const discussion = result.data
    ? await readPublicDiscussion(result.data.id)
    : null;
  const research = result.data?.living_research
    ? await readPublicResearch(result.data.id)
    : null;
  const requested = (await searchParams).research || '';
  const selected = /^[0-9a-f-]{36}$/.test(requested)
    ? requested
    : research?.data?.items[0]?.id || '';
  const investigation =
    result.data?.living_research && selected
      ? await readPublicInvestigation(result.data.id, selected)
      : null;
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
          <PublicDossierActions dossier={result.data} />
          {result.data.living_research && (
            <PublicResearchView
              publicationId={result.data.id}
              revision={result.data.revision}
              initial={research?.data || null}
              selectedId={selected}
              initialValue={investigation?.data || null}
            />
          )}
          <PublicDiscussion
            publicationId={result.data.id}
            living={result.data.living_research}
            publicationRevision={result.data.revision}
            initial={discussion?.data || null}
          />
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
