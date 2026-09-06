/**
 * Store selection.
 *
 * One implementation today. When Supabase is provisioned, a
 * `SupabaseProfileStore` lands beside `LocalProfileStore` and this function
 * picks between them on whether there is a signed-in user. Nothing in the
 * intake components changes.
 */

import { LocalProfileStore } from './local';
import type { ProfileStore } from './types';

export * from './types';
export { LocalProfileStore } from './local';

let cached: ProfileStore | undefined;

export function getProfileStore(): ProfileStore {
  cached ??= new LocalProfileStore();
  return cached;
}
