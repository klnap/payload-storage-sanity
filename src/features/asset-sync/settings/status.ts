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

/** Stored `unknown` / empty means “not classified yet”, not a final availability verdict. */
export function isUnsetSyncStatus(value: SanitySyncStatus | string | null | undefined): boolean {
  return value == null || value === '' || value === 'unknown'
}

/**
 * Derive sync status for a media row from stored value + upstream locators.
 * Fixes rows that have `checkedAt` but were left at placeholder `unknown`.
 */
export function resolveMediaSyncStatus(args: {
  stored?: SanitySyncStatus | string | null | undefined
  hasAssetId: boolean
  hasUpstream: boolean
  /** When there is no asset signal at all (draft row). */
  defaultWhenUnset?: SanitySyncStatus
}): SanitySyncStatus {
  const stored = args.stored
  if (!isUnsetSyncStatus(stored) && stored != null && isSanitySyncStatus(stored)) {
    return stored
  }

  if (args.hasAssetId || args.hasUpstream) {
    return args.hasUpstream ? 'available' : 'missing'
  }

  return args.defaultWhenUnset ?? 'unknown'
}
