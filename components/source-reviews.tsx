'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import { WorkField } from '@/components/action-dialog';
import { api, uid, date } from '@/lib/api';
import { product } from '@/lib/product';
import type { Entry, SourceDecision } from '@/lib/contracts';
import { useResource } from '@/lib/use-resource';
import {
  sourceDecisionLabels,
  reviewDraft,
  reviewConflict,
  rebaseReview,
  reviewRequest,
} from '@/lib/source-reviews';

export function SourceReviewStatus({ review }: { review?: Entry | null }) {
  const decision = review?.data.decision || 'unreviewed';
  return (
    <div className="source-review-status">
      <span className={`tag ${decision === 'include' ? 'good' : ''}`}>
        {sourceDecisionLabels[decision]}
      </span>
      {review && (
        <>
          <p>{review.body}</p>
          <p className="muted">
            {review.author} · {date(review.created_at)} · revision{' '}
            {review.data.revision}
          </p>
        </>
      )}
    </div>
  );
}

export function SourceReviews({
  dossierId,
  reference,
  canEdit,
  onClose,
  onSaved,
}: {
  dossierId: string;
  reference: Entry;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (review: Entry) => Promise<void>;
}) {
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState(() =>
    reviewDraft(reference.source_review, uid()),
  );
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const root = `/products/${product.id}/dossiers/${dossierId}/sources/${reference.id}/reviews`;
  const { data, error, loading, refresh } = useResource<{
    current: Entry | null;
    items: Entry[];
    total: number;
  }>(`${root}?offset=${offset}`);
  const conflict = !!data && reviewConflict(draft, data.current);
  async function save() {
    if (!data || error || conflict || saving || !canEdit) return;
    setSaving(true);
    setFailure('');
    try {
      const saved = await api<Entry>(root, reviewRequest(draft));
      await onSaved(saved);
      onClose();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="source-review-dialog">
        <DialogHeader>
          <DialogTitle>Review this source</DialogTitle>
          <DialogDescription>
            Record the team’s relevance decision for this exact URL in this
            dossier.
          </DialogDescription>
        </DialogHeader>
        <h3>{reference.title || 'Saved reference'}</h3>
        <a
          href={reference.url}
          target="_blank"
          rel="noreferrer"
          className="source-link break-url"
        >
          {reference.url}
        </a>
        <p className="muted">
          Exclusion affects new AI research using saved material at this exact
          URL. Previous answers, page watches and notifications remain
          available. Unreviewed sources remain eligible. This decision does not
          verify the source’s contents.
        </p>
        {(error || failure) && (
          <div className="banner error" role="alert">
            {error || failure}
          </div>
        )}
        {loading && <output>Loading source reviews…</output>}
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
          Refresh history
        </Button>
        {data && (
          <>
            <SourceReviewStatus review={data.current} />
            {canEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                {conflict && (
                  <div className="banner warning" role="alert">
                    <p>
                      A newer team decision is available. Your explanation is
                      retained. Review the current decision above before
                      continuing.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving || !!error}
                      onClick={() => {
                        setDraft(rebaseReview(draft, data.current, uid()));
                        setFailure('');
                      }}
                    >
                      Use current review as starting point
                    </Button>
                  </div>
                )}
                <WorkField label="Decision for new AI research">
                  <NativeSelect
                    value={draft.decision}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        decision: e.target.value as SourceDecision,
                        request_key: uid(),
                      })
                    }
                  >
                    {Object.entries(sourceDecisionLabels).map(
                      ([value, label]) => (
                        <NativeSelectOption value={value} key={value}>
                          {label}
                        </NativeSelectOption>
                      ),
                    )}
                  </NativeSelect>
                </WorkField>
                <WorkField label="Why is this source useful, uncertain or out of scope?">
                  <Textarea
                    required
                    minLength={3}
                    maxLength={2000}
                    value={draft.reason}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        reason: e.target.value,
                        request_key: uid(),
                      })
                    }
                    rows={3}
                  />
                </WorkField>
                <Button
                  type="submit"
                  disabled={
                    saving ||
                    conflict ||
                    !!error ||
                    draft.reason.trim().length < 3
                  }
                >
                  {saving ? 'Saving…' : 'Save team decision'}
                </Button>
              </form>
            )}
            <h3>Review history · {data.total}</h3>
            {data.items.map((review) => (
              <article className="source-review-history" key={review.id}>
                <SourceReviewStatus review={review} />
              </article>
            ))}
            {!data.total && (
              <p className="muted">No team review recorded yet.</p>
            )}
            {data.total > 50 && (
              <Pagination aria-label="Source review history pages">
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      disabled={saving || !offset}
                      onClick={() => setOffset(Math.max(0, offset - 50))}
                    >
                      <ArrowLeft size={16} />
                      Previous
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <span>
                      {offset + 1}–
                      {Math.min(offset + data.items.length, data.total)} of{' '}
                      {data.total}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      disabled={
                        saving || offset + data.items.length >= data.total
                      }
                      onClick={() => setOffset(offset + 50)}
                    >
                      Next
                      <ArrowRight size={16} />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
