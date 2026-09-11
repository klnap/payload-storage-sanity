import type { SanitySyncStatus } from '../sync/status'

export type SanityMediaSyncFields = {
  status?: SanitySyncStatus | null
  checkedAt?: string | null
  errorAt?: string | null
}
