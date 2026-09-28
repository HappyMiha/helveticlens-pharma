'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { api } from './api';
import { ResourceReader } from './resource-reader';

/** Ignore late responses when the user changes the resource or leaves the view. */
export function useResource<T>(url: string | null, refreshToken = 0) {
  const reader = useMemo(
    () =>
      new ResourceReader<T>(url, (path, signal) =>
        api<T>(path, undefined, undefined, signal),
      ),
    [url],
  );
  const state = useSyncExternalStore(
    reader.subscribe,
    reader.snapshot,
    reader.serverSnapshot,
  );
  useEffect(() => {
    reader.activate();
    void reader.refresh();
    const reset = () => {
      void reader.reset();
    };
    window.addEventListener('helvetic-session-changed', reset);
    return () => {
      window.removeEventListener('helvetic-session-changed', reset);
      reader.deactivate();
    };
  }, [reader, refreshToken]);
  return { ...state, refresh: reader.refresh };
}
