import type { CollectionAfterReadHook, CollectionBeforeChangeHook } from 'payload'

import { isUnavailableSyncStatus, normalizeSyncStatus } from '../sync/status'
import type { SanityMediaAsset } from '../types/image'
import { mediaSyncStatus, readMediaSync, type WithMediaSync } from '../utils/mediaSync'
import { slugifyFilename } from '../utils/slugify'

export type SanityMediaDocument = SanityMediaAsset & {
  createdAt?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  name?: string | null
}

function hasResolvableUrl(doc: SanityMediaDocument): boolean {
  return Boolean(doc.url && doc.url.trim().length > 0)
}

function hasSanityAssetId(doc: SanityMediaDocument): boolean {
  return Boolean(doc.sanity_id && doc.sanity_id.trim().length > 0)
}

/** Ensures media documents never expose broken upstream URLs to the Admin UI or APIs. */
export function sanitizeMediaDocument<T extends SanityMediaDocument>(doc: T): T {
  const hasUrl = hasResolvableUrl(doc)
  const hasAssetId = hasSanityAssetId(doc)

  if (!hasAssetId && !hasUrl) {
    return doc
  }

  let status = normalizeSyncStatus(mediaSyncStatus(doc))

  if (!status && hasAssetId) {
    status = hasUrl ? 'available' : 'missing'
  } else if (!isUnavailableSyncStatus(status) && !hasUrl && hasAssetId) {
    status = 'missing'
  }

  const existingSync = readMediaSync(doc)
  const checkedAt = existingSync.checkedAt ?? doc.createdAt ?? new Date().toISOString()

  if (isUnavailableSyncStatus(status) || (!hasUrl && hasAssetId)) {
    return {
      ...doc,
      sync: {
        ...existingSync,
        status: status ?? 'missing',
        checkedAt,
      },
      url: null,
    }
  }

  return {
    ...doc,
    sync: {
      ...existingSync,
      status: status ?? 'available',
      checkedAt,
    },
  }
}

export function createSanityMediaAfterReadHook(): CollectionAfterReadHook {
  return ({ doc }) => {
    if (!doc) return doc
    // SAFETY: afterRead runs only on media collection upload documents conforming to SanityMediaDocument
    return sanitizeMediaDocument(doc as SanityMediaDocument)
  }
}

export function createSanityMediaBeforeChangeHook(): CollectionBeforeChangeHook {
  return ({ data }) => {
    if (!data) return data

    // SAFETY: data incoming from media collection create/update operations
    // SAFETY: Payload beforeChange data contains incoming media fields
    const mediaData = data as SanityMediaDocument
    const hasMedia =
      hasSanityAssetId(mediaData) ||
      hasResolvableUrl(mediaData) ||
      Boolean(mediaData.filename && mediaData.filename.trim().length > 0)

    if (!hasMedia) {
      return data
    }

    // SAFETY: mediaData contains optional sync fields
    const sync = readMediaSync(mediaData as WithMediaSync)
    const rawStatus = mediaData.sync?.status
    const status = rawStatus ? normalizeSyncStatus(rawStatus) : 'available'
    const checkedAt = sync.checkedAt ?? new Date().toISOString()

    // Slugify originalFilename if present; never auto-copy it into name
    const slugifiedOriginalFilename =
      mediaData.originalFilename && mediaData.originalFilename.trim().length > 0
        ? slugifyFilename(mediaData.originalFilename)
        : mediaData.originalFilename

    const result = {
      ...data,
      originalFilename: slugifiedOriginalFilename,
      sync: {
        ...sync,
        status,
        checkedAt,
      },
    }

    // SAFETY: result matches the expected Payload document shape with resolved sync & originalFilename fields
    return result as typeof data
  }
}
