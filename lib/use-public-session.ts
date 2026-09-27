'use client';
import { useEffect } from 'react';
import type { Identity } from './contracts';
import { useResource } from './use-resource';
const EVENT = 'helveticlens:public-session';
export function publicSessionChanged() {
  window.dispatchEvent(new Event(EVENT));
}
export function usePublicSession() {
  const session = useResource<Identity>('/auth/session');
  const { refresh } = session;
  useEffect(() => {
    const update = () => {
      void refresh();
    };
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, [refresh]);
  return session;
}
