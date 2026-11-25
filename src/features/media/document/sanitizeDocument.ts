import { mediaSyncStatus, readMediaSync } from '@/features/asset-sync/mediaSync'
import {
  isUnavailableSyncStatus,
  resolveMediaSyncStatus,
} from '@/features/asset-sync/settings/status'
import type { SanityMediaDocument } from '@/features/media/document'
import { getSanityAssetId, getSanityAssetPath, getSanityAssetUrl } from '@/sanity/assets'
import { isPersistedHttpUrl } from '@/sanity/cdn'

export function hasUpstreamLocators(doc: SanityMediaDocument): boolean {
  const path = getSanityAssetPath(doc)?.trim()
  const url = getSanityAssetUrl(doc)?.trim()
  return Boolean(path || url)
}

const MEDIA_DOCUMENT_JUNK_KEYS = [
  '_objectKey',
  'sanityAssetMeta',
  'mediaMetadataInspector',
] as const

/** Drop cloud-storage / legacy display keys that must never leak into API or saves. */
export function stripMediaDocumentJunkKeys<T extends Record<string, unknown>>(doc: T): T {
  let touched = false
  for (const key of MEDIA_DOCUMENT_JUNK_KEYS) {
    if (key in doc) {
      touched = true
      break
    }
  }
  if (!touched) return doc
  const next = { ...doc }
  for (const key of MEDIA_DOCUMENT_JUNK_KEYS) {
    delete next[key]
  }
  return next
}

/** Ensures media documents never expose broken upstream URLs to the Admin UI or APIs. */
export function sanitizeMediaDocument<T extends SanityMediaDocument>(doc: T): T {
  const cleaned = stripMediaDocumentJunkKeys(doc as T & Record<string, unknown>) as T
  const hasUpstream = hasUpstreamLocators(cleaned)
  const hasId = Boolean(getSanityAssetId(cleaned)?.trim())

  if (!hasId && !hasUpstream) {
    return cleaned
  }

  let status = resolveMediaSyncStatus({
    stored: mediaSyncStatus(cleaned),
    hasAssetId: hasId,
    hasUpstream,
  })

  if (!isUnavailableSyncStatus(status) && !hasUpstream && hasId) {
    status = 'missing'
  }

  const existingSync = readMediaSync(cleaned)
  const checkedAt = existingSync.checkedAt ?? cleaned.createdAt ?? new Date().toISOString()

  if (isUnavailableSyncStatus(status) || (!hasUpstream && hasId)) {
    const persistedUrl = isPersistedHttpUrl(cleaned.url) ? cleaned.url : null
    return {
      ...cleaned,
      sync: {
        ...existingSync,
        status: status ?? 'missing',
        checkedAt,
      },
      url: isUnavailableSyncStatus(status) ? null : persistedUrl,
      thumbnailURL: null,
    }
  }

  return {
    ...cleaned,
    sync: {
      ...existingSync,
      status: status ?? 'available',
      checkedAt,
    },
  }
}
