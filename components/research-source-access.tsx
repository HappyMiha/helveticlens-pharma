'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { product } from '@/lib/product';
import {
  previewDocument,
  researchDocumentPage,
  researchDocumentPath,
} from '@/lib/research-document';
import type { ResearchDocumentTarget, ResearchSource } from '@/lib/contracts';
import { DocumentHistory } from './document-history';

export function ResearchSourceAccess({
  dossierId,
  source,
  note,
}: {
  dossierId: string;
  source: ResearchSource;
  note?: { id: string; questionId: string };
}) {
  const [target, setTarget] = useState<ResearchDocumentTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef({ value: 0 });
  useEffect(() => {
    const current = sequence.current;
    return () => {
      current.value++;
    };
  }, []);
  if (
    source.kind !== 'saved_page_extract' ||
    (!note && !previewDocument(source))
  )
    return null;
  async function open() {
    if (loading) return;
    const attempt = ++sequence.current.value;
    setLoading(true);
    setError('');
    try {
      const root = `/products/${product.id}/dossiers/${encodeURIComponent(dossierId)}`;
      const selected = note
        ? await api<ResearchDocumentTarget>(
            researchDocumentPath(root, note.questionId, note.id, source.id),
          )
        : previewDocument(source);
      if (attempt !== sequence.current.value) return;
      if (!selected)
        throw new Error(
          'The saved source identity is not available. Refresh the preview.',
        );
      researchDocumentPage(selected);
      setTarget(selected);
    } catch (failure) {
      if (attempt === sequence.current.value)
        setError((failure as Error).message);
    } finally {
      if (attempt === sequence.current.value) setLoading(false);
    }
  }
  return (
    <div className="research-document-access">
      <Button
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => void open()}
      >
        <BookOpen size={14} />
        {loading
          ? 'Opening saved source…'
          : error
            ? 'Retry saved document'
            : 'Read saved document'}
      </Button>
      {error && (
        <p className="source-health-warning" role="alert">
          {error} The excerpt remains available in the{' '}
          {note ? 'note' : 'preview'}.
        </p>
      )}
      {target && (
        <DocumentHistory
          key={`${target.document_id}:${target.version_id}:${target.expected_revision}`}
          dossierId={dossierId}
          documentId={target.document_id}
          name={source.title}
          initialPage={researchDocumentPage(target)}
          researchContext={{
            excerpt: source.text,
            revisionRecorded: target.revision_recorded,
            fromNote: !!note,
          }}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}
