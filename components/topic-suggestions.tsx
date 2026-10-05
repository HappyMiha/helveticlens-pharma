'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, uid } from '@/lib/api';
import type { DossierRecord, Profile, TopicSuggestions } from '@/lib/contracts';
import { Button } from './ui/button';

export interface SuggestionRequest {
  id: string;
  request_key: string;
  status:
    | 'queued'
    | 'running'
    | 'waiting'
    | 'completed'
    | 'failed'
    | 'superseded'
    | 'cancelled';
  expected_revision: number;
  error: string | null;
  result: TopicSuggestions | null;
}
type Reply = { request: SuggestionRequest | null };
const waiting = (request: SuggestionRequest | null) =>
  !!request && ['queued', 'running', 'waiting'].includes(request.status);

export function TopicSuggestionsRequest({
  profile,
  feedback,
  save,
  onResult,
  onReload,
  disabled,
}: {
  profile: Profile | null;
  feedback: string;
  save: () => Promise<DossierRecord>;
  onResult: (result: TopicSuggestions) => void;
  onReload: () => void;
  disabled: boolean;
}) {
  const [request, setRequest] = useState<SuggestionRequest | null>(null);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [readBlocked, setReadBlocked] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(!!profile);
  const lifecycle = useRef({
    active: true,
    reading: null as AbortController | null,
    sequence: 0,
  });
  const current = useRef<SuggestionRequest | null>(null);
  const readFailed = useRef(false);
  const posting = useRef(false);
  const delivered = useRef('');
  const callback = useRef(onResult);
  useEffect(() => {
    callback.current = onResult;
  }, [onResult]);
  const pending = useRef<{
    path: string;
    body: {
      request_key: string;
      expected_revision: number;
      feedback: string;
      locale: 'en-CH';
    };
  } | null>(null);
  const profileId = profile?.id;

  const receive = useCallback((value: Reply) => {
    current.current = value.request;
    setRequest(value.request);
    if (
      value.request?.status === 'completed' &&
      value.request.result &&
      delivered.current !== value.request.id
    ) {
      delivered.current = value.request.id;
      callback.current(value.request.result);
    }
  }, []);
  const refresh = useCallback(async () => {
    if (
      !lifecycle.current.active ||
      !profileId ||
      lifecycle.current.reading ||
      posting.current
    )
      return;
    const controller = new AbortController();
    lifecycle.current.reading = controller;
    const sequence = ++lifecycle.current.sequence;
    try {
      const value = await api<Reply>(
        `/monitoring-profiles/${profileId}/suggestions`,
        undefined,
        undefined,
        controller.signal,
      );
      if (
        !lifecycle.current.active ||
        controller.signal.aborted ||
        sequence !== lifecycle.current.sequence
      )
        return;
      readFailed.current = false;
      setReadBlocked(false);
      setError('');
      receive(value);
      if (
        pending.current &&
        value.request?.request_key === pending.current.body.request_key
      ) {
        pending.current = null;
        setUncertain(false);
      }
    } catch (failure) {
      if (
        !lifecycle.current.active ||
        controller.signal.aborted ||
        sequence !== lifecycle.current.sequence
      )
        return;
      readFailed.current = true;
      setReadBlocked(true);
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not check the saved request.',
      );
    } finally {
      if (lifecycle.current.reading === controller)
        lifecycle.current.reading = null;
      if (lifecycle.current.active && sequence === lifecycle.current.sequence)
        setLoading(false);
    }
  }, [profileId, receive]);
  useEffect(() => {
    const state = lifecycle.current;
    state.active = true;
    void Promise.resolve().then(refresh);
    const timer = window.setInterval(() => {
      if (waiting(current.current) && !readFailed.current) void refresh();
    }, 3000);
    return () => {
      state.active = false;
      state.sequence++;
      state.reading?.abort();
      state.reading = null;
      window.clearInterval(timer);
    };
    // Each saved profile owns its request and polling lifetime.
  }, [refresh]);

  async function submit() {
    if (posting.current || disabled || conflict || waiting(current.current))
      return;
    posting.current = true;
    setSending(true);
    setError('');
    lifecycle.current.reading?.abort();
    lifecycle.current.reading = null;
    lifecycle.current.sequence++;
    try {
      if (!pending.current) {
        const saved = await save();
        if (!lifecycle.current.active) return;
        pending.current = {
          path: `/monitoring-profiles/${saved.profile.id}/suggestions`,
          body: {
            request_key: uid(),
            expected_revision: saved.profile.revision,
            feedback,
            locale: 'en-CH',
          },
        };
      }
      setUncertain(true);
      const value = await api<Reply>(
        pending.current.path,
        pending.current.body,
      );
      if (!lifecycle.current.active) return;
      pending.current = null;
      setUncertain(false);
      readFailed.current = false;
      setReadBlocked(false);
      receive(value);
    } catch (failure) {
      if (lifecycle.current.active) {
        if (
          failure instanceof ApiError &&
          failure.status &&
          failure.status >= 400 &&
          failure.status < 500 &&
          ![408, 429].includes(failure.status)
        ) {
          if (failure.status === 409) setConflict(true);
          pending.current = null;
          setUncertain(false);
          readFailed.current = true;
          setReadBlocked(true);
        }
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not save the topic request.',
        );
      }
    } finally {
      posting.current = false;
      if (lifecycle.current.active) {
        setSending(false);
        setLoading(false);
      }
    }
  }

  return (
    <div className="form-stack">
      {request && (
        <output>
          {request.status === 'running'
            ? 'Preparing topics for your saved question. You can leave and return.'
            : waiting(request)
              ? 'Your request is saved and waiting for AI. It will continue automatically; you can leave and return.'
              : request.status === 'completed'
                ? 'Suggestions are ready. Choose the topics you want to use.'
                : request.status === 'superseded'
                  ? 'The saved question changed. Request fresh suggestions for the current version.'
                  : request.status === 'cancelled'
                    ? 'This request was cancelled. You can request suggestions again.'
                    : request.error ||
                      'Topics could not be prepared. Your draft is saved; you can try again.'}
        </output>
      )}
      {error && <p role="alert">{error}</p>}
      {conflict && (
        <div>
          <p>
            The saved draft changed. Your edits remain here. Reloading replaces
            unsaved setup edits with the saved version.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || sending}
            onClick={onReload}
          >
            Reload saved dossier
          </Button>
        </div>
      )}
      {error && profileId && (
        <Button
          type="button"
          variant="outline"
          disabled={loading || sending}
          onClick={() => {
            setLoading(true);
            void refresh();
          }}
        >
          Check saved request
        </Button>
      )}
      <Button
        type="button"
        disabled={
          disabled ||
          conflict ||
          sending ||
          loading ||
          waiting(request) ||
          (readBlocked && !uncertain)
        }
        onClick={() => void submit()}
      >
        {sending
          ? 'Saving request…'
          : waiting(request)
            ? 'Preparing suggestions…'
            : uncertain
              ? 'Retry same request'
              : request?.status === 'completed'
                ? 'Refine suggestions'
                : 'Suggest topics'}
      </Button>
    </div>
  );
}
