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
    window.addEventListener('helvetic-session-changed', update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener('helvetic-session-changed', update);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);
  return session;
}
