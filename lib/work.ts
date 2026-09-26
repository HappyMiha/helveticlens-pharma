import type { ActionStatus, Priority, WorkAction } from './contracts';

export const priorities: Priority[] = ['normal', 'high', 'urgent'];
export const actionStatuses: ActionStatus[] = [
  'open',
  'in_progress',
  'done',
  'cancelled',
];
export const statusLabel = (status: ActionStatus) =>
  ({
    open: 'To do',
    in_progress: 'In progress',
    done: 'Completed',
    cancelled: 'Dismissed',
  })[status];
export const priorityLabel = (priority: Priority) =>
  ({ normal: 'Normal', high: 'High', urgent: 'Urgent' })[priority];
export function day(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-CH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Europe/Zurich',
      }).format(new Date(value + 'T12:00:00Z'))
    : 'No date';
}
export function updateFields(action: WorkAction) {
  return {
    expected_revision: action.revision,
    title: action.title,
    detail: action.detail,
    status: action.status,
    priority: action.priority,
    assignee_user_id: action.assignee?.id || null,
    due_on: action.due_on,
    outcome: action.outcome,
  };
}
