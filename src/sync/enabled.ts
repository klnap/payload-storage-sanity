import type { SanityStoragePluginOptions } from '../types/index'

/** Upstream sync (DB fields, webhooks, reconciliation) is opt-in via `sync.enabled`. */
export function isSanitySyncEnabled(sync: SanityStoragePluginOptions['sync'] | undefined): boolean {
  return sync?.enabled === true
}
