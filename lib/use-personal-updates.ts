'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Private following state is transient, periodically reauthorized and never cached after an error. */
export function usePersonalUpdates<T>(url: string | null) {
  const epoch = useRef({ value: 0, fenced: false });
  const [stored, setStored] = useState<{ url: string; data: T } | null>(null);
  const [failure, setFailure] = useState<{
    url: string;
    message: string;
  } | null>(null);
  const refresh = useCallback(async () => {
    if (!url) return;
    epoch.current.fenced = false;
    const attempt = ++epoch.current.value;
    try {
      const data = await api<T>(url);
      if (attempt !== epoch.current.value) return;
      setStored({ url, data });
      setFailure(null);
    } catch (error) {
      if (attempt !== epoch.current.value) return;
      setStored(null);
      setFailure({ url, message: (error as Error).message });
    }
  }, [url]);
  useEffect(() => {
    const counter = epoch.current;
    counter.fenced = false;
    const update = () => {
      if (!counter.fenced) void refresh();
    };
    const clear = () => {
      counter.fenced = true;
      counter.value++;
      setStored(null);
      if (url)
        setFailure({
          url,
          message: 'Your session changed. Refresh your following settings.',
        });
    };
    update();
    const timer = url ? setInterval(update, 15000) : undefined;
    window.addEventListener('focus', update);
    window.addEventListener('helvetic-following-changed', update);
    window.addEventListener('helvetic-session-changed', clear);
    window.addEventListener('helveticlens:public-session', clear);
    return () => {
      counter.value++;
      clearInterval(timer);
      window.removeEventListener('focus', update);
      window.removeEventListener('helvetic-following-changed', update);
      window.removeEventListener('helvetic-session-changed', clear);
      window.removeEventListener('helveticlens:public-session', clear);
    };
  }, [url, refresh]);
  return {
    data: stored?.url === url ? stored.data : null,
    error: failure?.url === url ? failure.message : '',
    refresh,
  };
}
