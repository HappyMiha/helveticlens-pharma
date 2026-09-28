'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { date } from '@/lib/api';
import { SavedVersionContext } from './saved-version-context';
import { documentSourceLink } from '@/lib/version-context';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import {
  adjacentSnapshot,
  historyPath,
  newerHistory,
  olderHistory,
  snapshotPath,
} from '@/lib/document-history';
import type { HistoryPosition, PagePosition } from '@/lib/document-history';
import type {
  DocumentHistory as History,
  SavedPage,
  SavedPageVersion,
} from '@/lib/contracts';

function HistoryList({
  root,
  position,
  onMove,
  onRead,
  onReset,
}: {
  root: string;
  position: HistoryPosition;
  onMove: (position: HistoryPosition) => void;
  onRead: (version: SavedPageVersion, firstCursor: string) => void;
  onReset: () => void;
}) {
  const { data, error, loading, refresh } = useResource<History>(
    historyPath(root, position.cursor),
  );
  const [retrying, setRetrying] = useState(false);
  async function retry() {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }
  return (
    <>
      <div className="snapshot-actions">
        <Button variant="outline" onClick={onReset}>
          <RefreshCw size={15} /> Refresh history
        </Button>
      </div>
      {loading && <output>Loading saved versions…</output>}
      {error && (
        <div className="banner error" role="alert">
          <span>{error}</span>
          <Button
            variant="outline"
            disabled={retrying}
            onClick={() => void retry()}
          >
            Retry history
          </Button>
        </div>
      )}
      {!error && data && (
        <>
          <p className="muted">
            {data.total.toLocaleString()} saved versions · saved by{' '}
            {date(data.as_of)}. Refresh to include newer saves. Later
            corrections or backdated imports can change this list.
          </p>
          {!data.items.length && (
            <p className="work-empty">
              No saved versions are available on this page. Refresh history to
              check the current list.
            </p>
          )}
          <div className="snapshot-history-list">
            {data.items.map((version) => (
              <article key={version.id}>
                <h3>{version.title || data.document.name}</h3>
                <SavedVersionContext version={version} />
                <Button
                  variant="outline"
                  onClick={() => onRead(version, data.first_cursor)}
                >
                  <BookOpen size={15} /> Read saved text
                </Button>
              </article>
            ))}
          </div>
          <nav className="snapshot-actions" aria-label="Saved version history">
            <Button
              variant="outline"
              disabled={!position.previous.length}
              onClick={() => {
                const next = newerHistory(position);
                if (next) onMove(next);
              }}
            >
              Newer versions
            </Button>
            <span className="muted">Page {position.previous.length + 1}</span>
            <Button
              variant="outline"
              disabled={!data.next_cursor}
              onClick={() => {
                const next = olderHistory(position, data);
                if (next) onMove(next);
              }}
            >
              Older versions
            </Button>
          </nav>
        </>
      )}
    </>
  );
}

function SnapshotReader({
  root,
  position,
  onMove,
  onReload,
}: {
  root: string;
  position: PagePosition;
  onMove: (position: PagePosition) => void;
  onReload: () => void;
}) {
  const { data, error, loading, refresh } = useResource<SavedPage>(
    snapshotPath(root, position),
  );
  const [retrying, setRetrying] = useState(false);
  async function retry() {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }
  const original = documentSourceLink(data?.source_url, data?.document.url);
  return (
    <>
      <div className="snapshot-actions">
        <Button variant="outline" onClick={onReload}>
          <RefreshCw size={15} /> Reload current revision from start
        </Button>
      </div>
      {loading && <output>Loading saved text…</output>}
      {error && (
        <div className="banner error" role="alert">
          <span>{error}</span>
          <Button
            variant="outline"
            disabled={retrying}
            onClick={() => void retry()}
          >
            Retry this page
          </Button>
        </div>
      )}
      {!error && data && (
        <>
          <h3>{data.title || data.document.name}</h3>
          <SavedVersionContext version={data} />
          <p className="muted">
            {data.language ? `Language: ${data.language} · ` : ''}
            {data.content_type}. This is saved extracted text; the original page
            may have changed.
          </p>
          {original && (
            <a
              className="source-link break-url"
              href={original.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {original.recorded
                ? 'Open original source'
                : 'Open monitored page'}{' '}
              <ArrowUpRight size={14} />
            </a>
          )}
          <div className="snapshot-page-label">
            {data.pagination.total > 0 ? (
              <span>
                {data.pagination.mode === 'text' ? 'Characters' : 'Passages'}{' '}
                {(data.pagination.offset + 1).toLocaleString()}–
                {data.pagination.end.toLocaleString()} of{' '}
                {data.pagination.total.toLocaleString()}
              </span>
            ) : (
              <span>No extracted text is saved for this version.</span>
            )}
          </div>
          {data.omitted_passages > 0 && (
            <p className="source-health-warning">
              {data.omitted_passages} passage records on this page contain no
              readable text. Their positions remain included in the total.
            </p>
          )}
          {data.pagination.mode === 'text' ? (
            <div className="snapshot-text" lang={data.language || undefined}>
              {data.plain_text}
            </div>
          ) : (
            <div
              className="snapshot-passages"
              lang={data.language || undefined}
            >
              {data.passages.map((part, i) => (
                <section key={`${part.id}:${i}`}>
                  <p className="muted">
                    {part.id || 'Saved passage'}
                    {part.page ? ` · source page ${part.page}` : ''}
                  </p>
                  <div className="snapshot-text">
                    {part.text || 'This passage has no extracted text.'}
                  </div>
                </section>
              ))}
            </div>
          )}
          <nav className="snapshot-actions" aria-label="Saved text pages">
            <Button
              variant="outline"
              disabled={data.pagination.previous_offset === null}
              onClick={() => {
                const next = adjacentSnapshot(data, 'previous');
                if (next) onMove(next);
              }}
            >
              Previous text
            </Button>
            <Button
              variant="outline"
              disabled={data.pagination.next_offset === null}
              onClick={() => {
                const next = adjacentSnapshot(data, 'next');
                if (next) onMove(next);
              }}
            >
              Next text
            </Button>
          </nav>
        </>
      )}
    </>
  );
}

export function DocumentHistory({
  dossierId,
  documentId,
  name,
  initialPage,
  researchContext,
  onClose,
}: {
  dossierId: string;
  documentId: string;
  name: string;
  initialPage?: PagePosition;
  researchContext?: {
    excerpt: string;
    revisionRecorded: boolean;
    fromNote: boolean;
  };
  onClose: () => void;
}) {
  const root = `/products/${product.id}/dossiers/${encodeURIComponent(dossierId)}/documents/${encodeURIComponent(documentId)}/versions`;
  const [position, setPosition] = useState<HistoryPosition>({
    cursor: '',
    previous: [],
  });
  const [page, setPage] = useState<PagePosition | null>(initialPage || null);
  const [generation, setGeneration] = useState(0);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="snapshot-dialog">
        <DialogHeader>
          <DialogTitle>
            {page ? 'Saved source text' : 'Saved source history'}
          </DialogTitle>
          <DialogDescription>
            {name}. Inspect captured evidence without starting a new source
            check.
          </DialogDescription>
        </DialogHeader>
        {researchContext && (
          <aside className="research-document-context">
            <b>
              {researchContext.fromNote
                ? 'Excerpt retained with this AI note'
                : 'Excerpt selected for AI review'}
            </b>
            <p>
              {researchContext.fromNote
                ? 'The excerpt stays as recorded in the research.'
                : 'This excerpt belongs to the current preview. Return to the preview and choose Generate to request AI research.'}{' '}
              The full saved document below opens from its first page; reloading
              a corrected revision does not update this excerpt.
            </p>
            {!researchContext.revisionRecorded && (
              <p className="source-health-warning">
                This older note did not record the source revision. The reader
                opens the currently saved revision, which may differ from the
                excerpt.
              </p>
            )}
            <details>
              <summary>Compare the retained excerpt</summary>
              <p className="snapshot-text">{researchContext.excerpt}</p>
            </details>
          </aside>
        )}
        {page ? (
          <>
            <Button
              className="snapshot-back"
              variant="ghost"
              onClick={() => setPage(null)}
            >
              <ArrowLeft size={15} /> Back to saved versions
            </Button>
            <SnapshotReader
              key={`${page.id}:${page.offset}:${page.revision}:${generation}`}
              root={root}
              position={page}
              onMove={setPage}
              onReload={() => {
                setPage({ id: page.id, offset: 0 });
                setGeneration((n) => n + 1);
              }}
            />
          </>
        ) : (
          <HistoryList
            key={`${position.cursor}:${generation}`}
            root={root}
            position={position}
            onMove={setPosition}
            onRead={(version, cursor) => {
              setPosition((current) => ({
                ...current,
                cursor: current.cursor || cursor,
              }));
              setPage({
                id: version.id,
                offset: 0,
                revision: version.evidence_revision,
              });
            }}
            onReset={() => {
              setPosition({ cursor: '', previous: [] });
              setGeneration((n) => n + 1);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
