'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Ignore late responses when the user changes the resource or leaves the view. */
export function useResource<T>(url: string | null, refreshToken = 0) {
  const sequence = useRef({ value: 0 });
  const [result, setResult] = useState<{ url: string; data: T } | null>(null);
  const [failure, setFailure] = useState<{
    url: string;
    message: string;
  } | null>(null);
  const refresh = useCallback(async () => {
    if (!url) return;
    const id = ++sequence.current.value;
    try {
      const data = await api<T>(url);
      if (id === sequence.current.value) {
        setResult({ url, data });
        setFailure(null);
      }
    } catch (error) {
      if (id === sequence.current.value)
        setFailure({ url, message: (error as Error).message });
    }
  }, [url]);
  useEffect(() => {
    if (!url) return;
    const counter = sequence.current;
    const id = ++counter.value;
    void api<T>(url)
      .then((data) => {
        if (id === counter.value) {
          setResult({ url, data });
          setFailure(null);
        }
      })
      .catch((error: Error) => {
        if (id === counter.value) setFailure({ url, message: error.message });
      });
    return () => {
      counter.value++;
    };
  }, [url, refreshToken]);
  const data = result?.url === url ? result.data : null;
  const error = failure?.url === url ? failure.message : '';
  return { data, error, loading: !!url && !data && !error, refresh };
}
