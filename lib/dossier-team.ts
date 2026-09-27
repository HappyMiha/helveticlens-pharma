export type DossierRole = 'OWNER' | 'EDITOR' | 'CONTRIBUTOR' | 'VIEWER';
export type DossierAccess = {
  managed: boolean;
  is_guest?: boolean;
  can_configure?: boolean;
  revision: number;
  role: DossierRole | null;
  audience: 'author' | 'invited_team' | 'team' | 'workspace';
  can_contribute: boolean;
  can_edit: boolean;
  can_manage: boolean;
  can_enable: boolean;
  can_publish: boolean;
  can_monitor: boolean;
  can_watch_pages: boolean;
  can_activate: boolean;
};
export type TeamMember = {
  user_id: string;
  is_guest?: boolean;
  name: string;
  role: DossierRole;
  active: boolean;
  is_you: boolean;
};
export type DossierInvitation = {
  id: string;
  is_guest?: boolean;
  role: Exclude<DossierRole, 'OWNER'>;
  recipient_name: string;
  recipient_user_id: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};
export type DossierTeam = DossierAccess & {
  members: TeamMember[];
  colleagues: { user_id: string; name: string }[];
  invitations: DossierInvitation[];
};
export const ROLES: Record<DossierRole, string> = {
  OWNER: 'Owner',
  EDITOR: 'Editor',
  CONTRIBUTOR: 'Contributor',
  VIEWER: 'Viewer',
};
export function audienceDescription(audience: DossierAccess['audience']) {
  return audience === 'workspace'
    ? 'Everyone in this workspace can read this dossier. Workspace administrators inherit editing rights unless assigned a different dossier role.'
    : audience === 'team'
      ? 'Only accepted dossier members can read this dossier, its monitoring topics and matched evidence. Removing a role removes future access.'
      : audience === 'invited_team'
        ? 'Only the accepted dossier team can read this draft. At activation, choose team-only monitoring or explicitly share with the workspace.'
        : 'Only the creator can read this draft. Enable team management to invite colleagues or guests to this dossier.';
}
