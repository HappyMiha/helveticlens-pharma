import type { ThreadDetail } from './contracts';

export function answerReviewRequest(thread: ThreadDetail) {
  const fingerprint = thread.answer_review?.fingerprint;
  if (
    !thread.accepted_entry_id ||
    !Number.isSafeInteger(thread.revision) ||
    thread.revision < 1 ||
    typeof fingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(fingerprint)
  )
    throw new Error(
      'Refresh the question and inspect its current evidence before reconfirming.',
    );
  return {
    expected_revision: thread.revision,
    entry_id: thread.accepted_entry_id,
    expected_review: fingerprint,
  };
}
