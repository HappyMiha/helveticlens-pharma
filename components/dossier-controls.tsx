'use client';
import { useState } from 'react';
import { api, date } from '@/lib/api';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import type { WebResearch } from '@/lib/web-research';
import type { PrivateFollow } from '@/lib/research-following';
import { WebPolicyForm } from './web-research';
import { Button } from './ui/button';

export function DossierControls({
  dossierId,
  question,
  onChanged,
}: {
  dossierId: string;
  question: string;
  onChanged: () => Promise<void>;
}) {
  const base = `/products/${product.id}/dossiers/${dossierId}`;
  const schedule = useResource<WebResearch>(base + '/web-research');
  const personal = useResource<PrivateFollow>(base + '/follow');
  const current =
    personal.data?.dossier_id === dossierId && !personal.error
      ? personal.data
      : null;
  const monitoring =
    schedule.data?.dossier_id === dossierId && !schedule.error
      ? schedule.data
      : null;
  const [draft, setDraft] = useState<{
    revision: number;
    mode: string;
    email: string;
    confirmed: boolean;
  } | null>(null);
  const selected =
    draft && draft.revision === current?.revision
      ? draft
      : {
          revision: current?.revision ?? 0,
          mode: current?.delivery_mode || 'immediate',
          email: current?.email?.mode || 'off',
          confirmed: false,
        };
  const { mode, email, confirmed } = selected;
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function save(retry = false) {
    if (!current || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await api(base + '/follow', {
        expected_revision: current.revision,
        following: true,
        delivery_mode: mode,
        email_mode: email,
        email_confirmed: confirmed,
        retry_email: retry,
      });
      await personal.refresh();
      window.dispatchEvent(new Event('helvetic-following-changed'));
      setMessage('Your update preferences are saved.');
    } catch (error) {
      setMessage((error as Error).message);
      await personal.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="surface dossier-controls"
      aria-label="Dossier monitoring and your updates"
    >
      <h3>Keep this dossier current</h3>
      {schedule.error && (
        <p role="alert">
          {schedule.error}{' '}
          <Button variant="ghost" onClick={() => void schedule.refresh()}>
            Refresh monitoring
          </Button>
        </p>
      )}
      {!monitoring && !schedule.error && <output>Loading monitoring…</output>}
      {monitoring && (
        <>
          <p>
            <strong>
              {monitoring.policy.enabled
                ? monitoring.policy.cadence_hours === 24
                  ? 'Checked daily'
                  : 'Checked weekly'
                : 'Monitoring is off'}
            </strong>
          </p>
          <p>{monitoring.policy.question || question}</p>
          {monitoring.policy.enabled && (
            <p className="muted">
              Next check: {date(monitoring.policy.next_run_at)}.{' '}
              {monitoring.policy.readiness.reason}
            </p>
          )}
          <p className="muted">
            Checks use the dossier’s research and update its evidence, answer
            and open questions.
          </p>
          {monitoring.can_manage ? (
            <WebPolicyForm
              key={monitoring.policy.revision}
              base={base + '/web-research'}
              policy={monitoring.policy}
              initialQuestion={question}
              onSaved={() => {
                void schedule.refresh();
                void onChanged();
              }}
            />
          ) : (
            <p>
              A dossier editor manages its monitoring question and schedule.
            </p>
          )}
        </>
      )}
      <hr />
      <h3>Your updates</h3>
      <p className="muted">
        These choices apply to you. They do not change your colleagues’
        preferences.
      </p>
      {personal.error && (
        <p role="alert">
          {personal.error}{' '}
          <Button variant="ghost" onClick={() => void personal.refresh()}>
            Refresh preferences
          </Button>
        </p>
      )}
      {current && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy}>
            <label>
              In the application
              <select
                aria-label="In-app dossier updates"
                value={mode}
                onChange={(event) =>
                  setDraft({ ...selected, mode: event.target.value })
                }
              >
                <option value="immediate">
                  Important changes as they arrive
                </option>
                <option value="digest">Daily summary</option>
                <option value="silent">
                  Keep updates quietly in the dossier
                </option>
              </select>
            </label>
            <label>
              Email for this dossier
              <select
                aria-label="Email dossier updates"
                value={email}
                onChange={(event) => {
                  setDraft({
                    ...selected,
                    email: event.target.value,
                    confirmed: false,
                  });
                }}
              >
                <option value="off">No email</option>
                <option value="immediate">
                  Important changes as they arrive
                </option>
                <option value="daily">Daily summary</option>
                <option value="weekly">Weekly summary</option>
              </select>
            </label>
            {email !== 'off' && (
              <label className="evolution-checkbox">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) =>
                    setDraft({ ...selected, confirmed: event.target.checked })
                  }
                />
                Send this dossier’s updates to my verified email address.
              </label>
            )}
            {current.email?.last_sent_at && (
              <p className="muted">
                Last email: {date(current.email.last_sent_at)}
              </p>
            )}
            {current.email?.mode !== 'off' &&
              current.email?.next_delivery_at && (
                <p className="muted">
                  Next email check: {date(current.email.next_delivery_at)}. A
                  summary is sent only when updates are available.
                </p>
              )}
            {current.email?.state === 'email_unavailable' && (
              <output>
                Email delivery is unavailable. Your updates are still saved
                here.
              </output>
            )}
            {current.email?.state === 'access_unavailable' && (
              <output>
                Email is paused until your account and dossier access can be
                verified.
              </output>
            )}
            {current.email?.state === 'delivery_uncertain' && (
              <output>
                We could not confirm the last email was delivered. Retrying may
                send it again.
                <Button
                  type="button"
                  variant="outline"
                  disabled={!confirmed}
                  onClick={() => void save(true)}
                >
                  Retry email delivery
                </Button>
              </output>
            )}
            <Button
              type="submit"
              disabled={busy || (email !== 'off' && !confirmed)}
            >
              {busy ? 'Saving…' : 'Save my updates'}
            </Button>
          </fieldset>
        </form>
      )}
      {message && <output>{message}</output>}
    </section>
  );
}
