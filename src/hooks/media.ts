import type { CollectionAfterReadHook, CollectionBeforeChangeHook } from 'payload'

import { applyPopulatePreset } from '../populate/applyPopulatePreset'
import { presetUsesDefaultPopulate } from '../populate/presets'
import type { SanityMediaPopulatePresetRegistry } from '../populate/presets'
import { shouldApplyDefaultPopulate } from '../populate/shouldApplyDefaultPopulate'
import { isUnavailableSyncStatus, normalizeSyncStatus } from '../sync/status'
import type { SanityMediaDocument } from '../types/sanityStorageDocument'
import { resolvePublicUrl } from '../utils/resolvePublicUrl'
import { mediaSyncStatus, readMediaSync, type WithMediaSync } from '../utils/mediaSync'
import { slugifyFilename } from '../utils/slugify'

export type { SanityMediaDocument }

function hasUpstreamLocators(doc: SanityMediaDocument): boolean {
  const path = doc.sanity?.path?.trim()
  const url = doc.sanity?.url?.trim()
  return Boolean(path || url)
}

/** Ensures media documents never expose broken upstream URLs to the Admin UI or APIs. */
export function sanitizeMediaDocument<T extends SanityMediaDocument>(doc: T): T {
  const hasUpstream = hasUpstreamLocators(doc)
  const hasId = Boolean(doc.sanity?.id?.trim())

  if (!hasId && !hasUpstream) {
    return doc
  }

  let status = normalizeSyncStatus(mediaSyncStatus(doc))

  if (!status && hasId) {
    status = hasUpstream ? 'available' : 'missing'
  } else if (!isUnavailableSyncStatus(status) && !hasUpstream && hasId) {
    status = 'missing'
  }

  const existingSync = readMediaSync(doc)
  const checkedAt = existingSync.checkedAt ?? doc.createdAt ?? new Date().toISOString()

  if (isUnavailableSyncStatus(status) || (!hasUpstream && hasId)) {
    return {
      ...doc,
      sync: {
        ...existingSync,
        status: status ?? 'missing',
        checkedAt,
      },
      url: null,
      thumbnailURL: null,
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

function hydrateMediaOnRead(doc: SanityMediaDocument, cdnBaseUrl?: string): SanityMediaDocument {
  const url = resolvePublicUrl(doc, { cdnBaseUrl })
  const thumbnailURL = resolvePublicUrl(doc, {
    cdnBaseUrl,
    transform: { width: 300, fit: 'max', autoFormat: true },
  })

  return {
    ...doc,
    url,
    thumbnailURL,
  }
}

export type CreateSanityMediaAfterReadHookArgs = {
  collectionSlug: string
  cdnBaseUrl?: string
  resolvedPreset: string
  registry: SanityMediaPopulatePresetRegistry
}

export function createSanityMediaAfterReadHook(
  args: CreateSanityMediaAfterReadHookArgs
): CollectionAfterReadHook {
  return ({ doc, req, context, findMany }) => {
    if (!doc) return doc

    let mediaDoc = sanitizeMediaDocument(doc as SanityMediaDocument)
    mediaDoc = hydrateMediaOnRead(mediaDoc, args.cdnBaseUrl)

    const locale = req?.locale

    if (
      shouldApplyDefaultPopulate({
        req,
        context,
        collectionSlug: args.collectionSlug,
        findMany,
      }) &&
      presetUsesDefaultPopulate(args.resolvedPreset, args.registry)
    ) {
      return applyPopulatePreset(mediaDoc, args.resolvedPreset, args.registry, {
        cdnBaseUrl: args.cdnBaseUrl,
        locale,
      }) as typeof doc
    }

    return mediaDoc as typeof doc
  }
}

export function createSanityMediaBeforeChangeHook(): CollectionBeforeChangeHook {
  return ({ data }) => {
    if (!data) return data

    const mediaData = data as SanityMediaDocument
    const hasMedia =
      Boolean(mediaData.sanity?.id?.trim()) ||
      hasUpstreamLocators(mediaData) ||
      Boolean(mediaData.filename && mediaData.filename.trim().length > 0)

    if (!hasMedia) {
      return data
    }

    const sync = readMediaSync(mediaData as WithMediaSync)
    const rawStatus = mediaData.sync?.status
    const status = rawStatus ? normalizeSyncStatus(rawStatus) : 'available'
    const checkedAt = sync.checkedAt ?? new Date().toISOString()

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

    return result as typeof data
  }
}
