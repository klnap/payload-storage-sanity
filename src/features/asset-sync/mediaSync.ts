import type { SanityPersistedAssetGroup } from '@/sanity/assets'
import type { SanitySyncStatus } from './settings/status'

export type SanityMediaSyncFields = {
  status?: SanitySyncStatus | null
  checkedAt?: string | null
  errorAt?: string | null
}

export type WithMediaSync = {
  sanity?: SanityPersistedAssetGroup | null
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
