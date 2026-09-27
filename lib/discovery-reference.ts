import type { SearchHit } from './contracts';

export function sourceImport(
  hit: SearchHit,
  keys: Map<string, string>,
  makeKey: () => string,
) {
  const receipt = hit.discovery_receipt;
  if (!receipt || receipt.length > 24576 || hit.dossier_id)
    throw new Error(
      'Run this public source search again before saving the record.',
    );
  let key = keys.get(receipt);
  if (!key) {
    key = makeKey();
    keys.set(receipt, key);
  }
  return { request_key: key, receipt };
}
