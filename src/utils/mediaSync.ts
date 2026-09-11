import type { SanitySyncStatus } from '../sync/status'
import type { SanityMediaSyncFields } from '../types/sync'

export type { SanityMediaSyncFields }

export type WithMediaSync = {
  sanity_id?: string | null
  sanityAssetId?: string | null
  sync?: SanityMediaSyncFields | null
}

export function readMediaSync(doc: WithMediaSync): SanityMediaSyncFields {
  const sync = doc.sync
  if (sync != null) {
    return sync
  }
  return {}
}

export function mergeMediaSync(doc: WithMediaSync, patch: Partial<SanityMediaSyncFields>) {
  return {
    sync: {
      ...readMediaSync(doc),
      ...patch,
    },
  }
}

export function mediaSyncStatus(doc: WithMediaSync): SanitySyncStatus | null | undefined {
  return readMediaSync(doc).status
}
