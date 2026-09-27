'use client';
import { useEffect, useState } from 'react';
import type { Investigation } from '@/lib/investigation';
import {
  investigationActivity,
  type LensActivity,
  type LensState,
} from '@/lib/lens';

export function LensOverlay({ state }: { state: LensState }) {
  if (state === 'idle' || state === 'complete') return null;
  return (
    <span className="lens-overlay" data-lens-state={state} aria-hidden="true">
      <span className="lens-optic" />
    </span>
  );
}

export function LensProgress({ activity }: { activity: LensActivity }) {
  return (
    <div className="lens-progress" data-lens-state={activity.state}>
      <LensOverlay state={activity.state} />
      <div>
        <span className="eyebrow">Research activity</span>
        <output aria-live="polite">{activity.label}</output>
        {activity.detail && <p>{activity.detail}</p>}
      </div>
    </div>
  );
}

export function LensAnalysisState({ value }: { value: Investigation }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(timer);
  }, []);
  return <LensProgress activity={investigationActivity(value, now)} />;
}
