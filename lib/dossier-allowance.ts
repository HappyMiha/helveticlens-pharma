export type LimitRequest = {
  id: string;
  requested_limit: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  revision: number;
  approved_limit: number | null;
  mail_state: string;
};
export type DossierAllowance = {
  limit: number;
  used: number;
  remaining: number;
  latest_request: LimitRequest | null;
};
