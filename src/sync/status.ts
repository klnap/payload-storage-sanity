/** Upstream Sanity asset availability tracked on Payload media rows. */
export const SANITY_SYNC_STATUSES = ['available', 'missing', 'deleted', 'error', 'unknown'] as const

export type SanitySyncStatus = (typeof SANITY_SYNC_STATUSES)[number]

export function isUnavailableSyncStatus(status: SanitySyncStatus | null | undefined): boolean {
  return status === 'missing' || status === 'deleted' || status === 'error'
}

function isSanitySyncStatus(value: string): value is SanitySyncStatus {
  // SAFETY: membership check narrows to SANITY_SYNC_STATUSES union
  return (SANITY_SYNC_STATUSES as readonly string[]).includes(value)
}

export function normalizeSyncStatus(
  value: SanitySyncStatus | string | null | undefined
): SanitySyncStatus {
  if (value != null && isSanitySyncStatus(value)) {
    return value
  }
  return 'unknown'
}
