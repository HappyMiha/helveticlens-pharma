'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { api, date, uid } from '@/lib/api';
import { product } from '@/lib/product';
import { audienceDescription, ROLES } from '@/lib/dossier-team';
import type {
  DossierAccess,
  DossierInvitation,
  DossierRole,
  DossierTeam,
  TeamMember,
} from '@/lib/dossier-team';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

const ROOT = `/products/${product.id}`;

export function TeamAudience({ access }: { access: DossierAccess }) {
  return (
    <div className="team-audience">
      <p>{audienceDescription(access.audience)}</p>
      <p className="source-meta">
        Your role: {access.role ? ROLES[access.role] : 'No access'}. Invitations
        apply to this dossier in the current workspace.
      </p>
    </div>
  );
}

export function TeamRoles() {
  return (
    <dl className="team-role-guide">
      <div>
        <dt>Owner</dt>
        <dd>
          Manage people, transfer ownership and publish a reviewed public
          snapshot.
        </dd>
      </div>
      <div>
        <dt>Editor</dt>
        <dd>
          Edit the dossier, review evidence and start or control research.
        </dd>
      </div>
      <div>
        <dt>Contributor</dt>
        <dd>
          Add comments, links, corrections and files, and analyse those
          contributions.
        </dd>
      </div>
      <div>
        <dt>Viewer</dt>
        <dd>
          Read sources, findings and history, and download retained evidence.
        </dd>
      </div>
    </dl>
  );
}

function MemberRow({
  member,
  canManage,
  busy,
  change,
  remove,
}: {
  member: TeamMember;
  canManage: boolean;
  busy: boolean;
  change: (role: DossierRole) => void;
  remove: () => void;
}) {
  const [role, setRole] = useState(member.role);
  return (
    <li className="team-person">
      <div>
        <strong>
          {member.name}
          {member.is_you ? ' (you)' : ''}
        </strong>
        <p className="source-meta">
          {member.active ? ROLES[member.role] : 'Inactive account'}
        </p>
      </div>
      {canManage ? (
        <div className="team-person-actions">
          <NativeSelect
            aria-label={`Role for ${member.name}`}
            value={role}
            onChange={(e) => setRole(e.target.value as DossierRole)}
            disabled={busy}
          >
            {Object.entries(ROLES).map(([key, label]) => (
              <NativeSelectOption key={key} value={key}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            variant="outline"
            disabled={
              busy ||
              role === member.role ||
              (!member.active && role === 'OWNER')
            }
            onClick={() => change(role)}
          >
            {role === 'OWNER' ? 'Make owner' : 'Save role'}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={remove}>
            Remove role
          </Button>
        </div>
      ) : (
        <span>{ROLES[member.role]}</span>
      )}
    </li>
  );
}

export function DossierTeamPanel({
  dossierId,
  access,
  onChanged,
  onLeave,
}: {
  dossierId: string;
  access?: DossierAccess;
  onChanged: () => Promise<void>;
  onLeave: () => void;
}) {
  const base = `${ROOT}/dossiers/${dossierId}/team`;
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<DossierTeam | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recipient, setRecipient] = useState('');
  const [role, setRole] = useState<DossierInvitation['role']>('CONTRIBUTOR');
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const generation = useRef({ value: 0 });
  const load = useCallback(async () => {
    const attempt = ++generation.current.value;
    try {
      const result = await api<DossierTeam>(base);
      if (attempt === generation.current.value) {
        setTeam(result);
        setError('');
      }
    } catch (e) {
      if (attempt === generation.current.value) {
        setTeam(null);
        setError((e as Error).message);
      }
    }
  }, [base]);
  useEffect(() => {
    const epoch = generation.current;
    const attempt = ++epoch.value;
    if (open) {
      api<DossierTeam>(base).then(
        (result) => {
          if (attempt === epoch.value) {
            setTeam(result);
            setError('');
          }
        },
        (error: Error) => {
          if (attempt === epoch.value) {
            setTeam(null);
            setError(error.message);
          }
        },
      );
    }
    return () => {
      epoch.value++;
    };
  }, [base, open, access?.revision]);
  async function mutation(path: string, body: object, method = 'POST') {
    if (busy || !team) return;
    setBusy(true);
    setError('');
    setNotice('');
    const attempt = generation.current.value;
    try {
      const result = await api<DossierTeam & { removed_self?: boolean }>(
        base + path,
        { ...body, expected_revision: team.revision },
        method,
      );
      if (attempt !== generation.current.value) return;
      if (result.removed_self) {
        onLeave();
        return;
      }
      await load();
      await onChanged();
      setNotice('Dossier team updated.');
    } catch (e) {
      if (attempt === generation.current.value) {
        setError((e as Error).message);
        setTeam(null);
      }
    } finally {
      setBusy(false);
    }
  }
  async function invite(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!team?.can_manage || !recipient || busy) return;
    const fingerprint = `${recipient}:${role}`;
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, key: uid() };
    setBusy(true);
    setError('');
    setNotice('');
    const attempt = generation.current.value;
    try {
      await api(base + '/invitations', {
        request_key: pending.current.key,
        user_id: recipient,
        role,
        expected_revision: team.revision,
      });
      if (attempt !== generation.current.value) return;
      pending.current = null;
      setRecipient('');
      await load();
      await onChanged();
      setNotice(
        'Invitation saved. Your colleague can accept it in their dossier invitations. No email was sent.',
      );
    } catch (e) {
      if (attempt === generation.current.value) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const shownAccess = team || access;
  return (
    <details
      className="dossier-team"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <Users size={18} /> Dossier team
        {shownAccess?.role ? ` · ${ROLES[shownAccess.role]}` : ''}
      </summary>
      {shownAccess && <TeamAudience access={shownAccess} />}
      {open && (
        <div className="team-content">
          <TeamRoles />
          {!team && !error && <output>Loading current access…</output>}
          {team?.can_enable && (
            <Button
              disabled={busy}
              onClick={() => void mutation('/enable', {})}
            >
              Enable dossier team management
            </Button>
          )}
          {team && !team.managed && !team.can_enable && (
            <p>
              The original creator can enable team management. Existing
              workspace access still applies.
            </p>
          )}
          {!!team?.members.length && (
            <ul className="team-people">
              {team.members.map((member) => (
                <MemberRow
                  key={`${member.user_id}:${member.role}`}
                  member={member}
                  canManage={team.can_manage}
                  busy={busy}
                  change={(value) =>
                    void mutation(
                      `/members/${member.user_id}`,
                      { role: value },
                      'PUT',
                    )
                  }
                  remove={() =>
                    void mutation(`/members/${member.user_id}/remove`, {})
                  }
                />
              ))}
            </ul>
          )}
          {team?.can_manage && (
            <>
              <p className="source-meta">
                To transfer ownership, make an accepted colleague an owner, then
                change your own role. The last active owner cannot be removed.
                Removing a role from an active dossier restores that colleague’s
                workspace access.
              </p>
              <form className="team-invite" onSubmit={invite}>
                <div>
                  <label htmlFor={`team-colleague-${dossierId}`}>
                    Invite a workspace colleague
                  </label>
                  <NativeSelect
                    id={`team-colleague-${dossierId}`}
                    required
                    value={recipient}
                    disabled={busy}
                    onChange={(e) => setRecipient(e.target.value)}
                  >
                    <NativeSelectOption value="">
                      Choose a colleague
                    </NativeSelectOption>
                    {team.colleagues.map((person) => (
                      <NativeSelectOption
                        key={person.user_id}
                        value={person.user_id}
                      >
                        {person.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <label htmlFor={`team-invite-role-${dossierId}`}>
                    Dossier role
                  </label>
                  <NativeSelect
                    id={`team-invite-role-${dossierId}`}
                    value={role}
                    disabled={busy}
                    onChange={(e) =>
                      setRole(e.target.value as DossierInvitation['role'])
                    }
                  >
                    {(['CONTRIBUTOR', 'EDITOR', 'VIEWER'] as const).map(
                      (value) => (
                        <NativeSelectOption key={value} value={value}>
                          {ROLES[value]}
                        </NativeSelectOption>
                      ),
                    )}
                  </NativeSelect>
                </div>
                <Button type="submit" disabled={busy || !recipient}>
                  Create invitation
                </Button>
              </form>
              <p className="source-meta">
                Invitations expire after seven days and work only for the
                selected account. People outside this workspace must first join
                through <Link href="/?view=team">Workspace team</Link>.
              </p>
              {!!team.invitations.length && (
                <ul className="team-people" aria-label="Pending invitations">
                  {team.invitations.map((item) => (
                    <li className="team-person" key={item.id}>
                      <div>
                        <strong>{item.recipient_name}</strong>
                        <p className="source-meta">
                          {ROLES[item.role]} · expires {date(item.expires_at)}
                        </p>
                      </div>
                      <div className="team-person-actions">
                        <Button
                          variant="outline"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(
                                `${window.location.origin}/?invitation=${item.id}`,
                              )
                              .then(
                                () =>
                                  setNotice(
                                    'Account-bound invitation link copied.',
                                  ),
                                () =>
                                  setError(
                                    'Could not copy. Your colleague can open their dossier invitations directly.',
                                  ),
                              );
                          }}
                        >
                          Copy invitation link
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            void mutation(`/invitations/${item.id}/revoke`, {})
                          }
                        >
                          Revoke invitation
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="investigation-error">
              {error}
            </p>
          )}
          {notice && <output>{notice}</output>}
          <Button variant="ghost" disabled={busy} onClick={() => void load()}>
            Refresh access
          </Button>
        </div>
      )}
    </details>
  );
}

type InboxInvitation = DossierInvitation & {
  dossier_id: string;
  title: string;
  invited_by: string;
  audience: 'invited_team' | 'workspace';
};

export function DossierInvitationInbox({
  onAccepted,
  refreshToken,
}: {
  onAccepted: (id: string) => Promise<void>;
  refreshToken: number;
}) {
  const [items, setItems] = useState<InboxInvitation[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const alive = useRef(true);
  const [requested, setRequested] = useState('');

  useEffect(() => {
    alive.current = true;
    let current = true;
    const invitationId =
      new URLSearchParams(window.location.search).get('invitation') || '';
    api<{ items: InboxInvitation[]; total: number }>(
      `${ROOT}/dossier-invitations`,
    ).then(
      (result) => {
        if (current) {
          setRequested(invitationId);
          setItems(result.items);
          setTotal(result.total);
          setError('');
        }
      },
      (e: Error) => {
        if (current) {
          setRequested(invitationId);
          setItems([]);
          setError(e.message);
        }
      },
    );
    return () => {
      current = false;
      alive.current = false;
    };
  }, [refreshToken]);
  async function accept(item: InboxInvitation) {
    if (busy) return;
    setBusy(item.id);
    setError('');
    try {
      const result = await api<{ dossier_id: string }>(
        `${ROOT}/dossier-invitations/${item.id}/accept`,
        {},
      );
      if (!alive.current) return;
      setItems((old) => old.filter((value) => value.id !== item.id));
      setTotal((old) => Math.max(0, old - 1));
      setRequested('');
      await onAccepted(result.dossier_id);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy('');
    }
  }
  async function more() {
    if (busy) return;
    setBusy('loading');
    try {
      const page = await api<{ items: InboxInvitation[]; total: number }>(
        `${ROOT}/dossier-invitations?offset=${items.length}`,
      );
      if (alive.current) {
        setItems((old) => [
          ...old,
          ...page.items.filter(
            (item) => !old.some((value) => value.id === item.id),
          ),
        ]);
        setTotal(page.total);
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy('');
    }
  }
  if (!items.length && !error && !requested) return null;
  return (
    <details
      className="dossier-team invitation-inbox"
      open={requested ? true : undefined}
    >
      <summary>
        <Users size={18} /> Dossier invitations · {total}
      </summary>
      <div className="team-content">
        {requested && !items.some((item) => item.id === requested) && (
          <p>
            Use the invited account and workspace. An accepted, expired or
            revoked invitation may no longer appear here.
          </p>
        )}
        <ul className="team-people">
          {items.map((item) => (
            <li className="team-person" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>
                  Invited by {item.invited_by} as {ROLES[item.role]}
                </p>
                <p className="source-meta">
                  {item.audience === 'invited_team'
                    ? 'Private team draft'
                    : 'Shared workspace dossier'}{' '}
                  · expires {date(item.expires_at)}
                </p>
              </div>
              <Button disabled={!!busy} onClick={() => void accept(item)}>
                Accept invitation
              </Button>
            </li>
          ))}
        </ul>
        {items.length < total && (
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => void more()}
          >
            More invitations
          </Button>
        )}
        {error && (
          <p role="alert" className="investigation-error">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
