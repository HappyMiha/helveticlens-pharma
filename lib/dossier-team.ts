export type DossierRole = 'OWNER' | 'EDITOR' | 'CONTRIBUTOR' | 'VIEWER';
export type DossierAccess = {
  managed: boolean;
  revision: number;
  role: DossierRole | null;
  audience: 'author' | 'invited_team' | 'workspace';
  can_contribute: boolean;
  can_edit: boolean;
  can_manage: boolean;
  can_enable: boolean;
  can_publish: boolean;
  can_monitor: boolean;
  can_activate: boolean;
};
export type TeamMember = {
  user_id: string;
  name: string;
  role: DossierRole;
  active: boolean;
  is_you: boolean;
};
export type DossierInvitation = {
  id: string;
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
    : audience === 'invited_team'
      ? 'Only the accepted dossier team can read this draft. Activating monitoring shares the dossier with the whole workspace.'
      : 'Only the creator can read this draft. Enable team management to invite workspace colleagues.';
}
