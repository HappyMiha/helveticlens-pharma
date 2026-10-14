'use client';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, uid } from './api';

// A feed can render many result actions; share one session listener per window.
const sessionResets = new WeakMap<
  EventTarget,
  { callbacks: Set<() => void>; dispatch: () => void }
>();
function subscribeSessionReset(callback: () => void) {
  const target = window;
  let state = sessionResets.get(target);
  if (!state) {
    const callbacks = new Set<() => void>();
    const dispatch = () => {
      const queued = [...callbacks];
      for (const reset of queued) reset();
    };
    state = { callbacks, dispatch };
    sessionResets.set(target, state);
    target.addEventListener('helvetic-session-changed', dispatch);
  }
  state.callbacks.add(callback);
  const current = state;
  return () => {
    current.callbacks.delete(callback);
    if (!current.callbacks.size) {
      target.removeEventListener('helvetic-session-changed', current.dispatch);
      sessionResets.delete(target);
    }
  };
}

type Command = { path: string; body: unknown; method: string };
/** Keep an uncertain write's exact identity; acknowledged writes retry only their view callback. */
export function useFeedCommand<T>(
  onSaved: (value: T, command: Readonly<Command>) => Promise<void> | void,
) {
  const pending = useRef<Command | null>(null);
  const acknowledged = useRef<{ value: T } | null>(null);
  const sending = useRef(false);
  const lifecycle = useRef({ generation: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const life = lifecycle.current;
    const reset = () => {
      life.generation++;
      pending.current = null;
      acknowledged.current = null;
      sending.current = false;
      setBusy(false);
      setError('');
      setUncertain(false);
      setSaved(false);
    };
    const unsubscribe = subscribeSessionReset(reset);
    return () => {
      life.generation++;
      unsubscribe();
    };
  }, []);
  async function execute(
    path: string,
    body: Record<string, unknown> | undefined,
    method = 'POST',
    requestKey = true,
  ) {
    if (sending.current) return;
    pending.current ??= {
      path,
      body:
        body === undefined
          ? undefined
          : requestKey
            ? { ...body, request_key: uid() }
            : body,
      method,
    };
    const command = pending.current;
    sending.current = true;
    setBusy(true);
    setError('');
    const generation = lifecycle.current.generation;
    const current = () => lifecycle.current.generation === generation;
    try {
      if (!acknowledged.current) {
        const value = await api<T>(command.path, command.body, command.method);
        if (!current()) return;
        acknowledged.current = { value };
        setSaved(true);
        setUncertain(false);
      }
      await onSaved(acknowledged.current.value, command);
      if (!current()) return;
      pending.current = null;
      acknowledged.current = null;
      setSaved(false);
      setUncertain(false);
    } catch (cause) {
      if (current()) {
        const rejected =
          cause instanceof ApiError &&
          cause.status !== null &&
          [400, 401, 403, 404, 409, 422].includes(cause.status);
        if (rejected && !acknowledged.current) pending.current = null;
        setUncertain(!acknowledged.current && !rejected);
        setError(
          acknowledged.current
            ? 'The change was saved. Refresh its saved view to continue.'
            : cause instanceof Error
              ? cause.message
              : 'Could not save. Your input is retained.',
        );
      }
    } finally {
      if (current()) {
        sending.current = false;
        setBusy(false);
      }
    }
  }
  return {
    execute,
    retry: () => {
      const command = pending.current;
      if (command) return execute(command.path, undefined, command.method);
    },
    busy,
    error,
    uncertain,
    saved,
    locked: busy || uncertain || saved,
  };
}
