import type {
  CollectionAfterChangeHook,
  CollectionAfterReadHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
} from 'payload'

import { sanityAssetIdFromDocument } from '../adapter/metadata'
import type { SanityAssetIdCarrier } from '../utils/payloadMedia'

import { applyPopulatePreset } from '../populate/applyPopulatePreset'
import { shouldMorphMediaPopulate } from '../populate/requestContext'
import { shouldApplyDefaultPopulate } from '../populate/shouldApplyDefaultPopulate'
import { isUnavailableSyncStatus, normalizeSyncStatus } from '../sync/status'
import type { SanityMediaDocument, SanityUpstreamFields } from '../types/sanityStorageDocument'
import { resolvePublicUrl } from '../utils/resolvePublicUrl'
import { mediaSyncStatus, readMediaSync, type WithMediaSync } from '../utils/mediaSync'
import { normalizeLocalizedAltGroup } from '../utils/normalizeMediaAlt'
import { slugifyFilename } from '../utils/slugify'
import {
  getUploadEditsFromRequest,
  isCloudStorageUpstreamMetadataUpdate,
  isFocalOnlyUploadEdits,
  uploadEditsRequireBytesReupload,
  uploadEditsRequireBytesReuploadFromRequest,
} from '../utils/uploadEdits'

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

export const SANITY_MEDIA_REPROCESS_CONTEXT_KEY = 'sanityMediaReprocessed' as const

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
  altFallbackLocale?: string
  localPopulate?: boolean
  /** When true, `alt` is the injected locale group — coerce SQL `null` to `{}` for admin form state. */
  localizedAltGroup?: boolean
}

export function createSanityMediaAfterReadHook(
  args: CreateSanityMediaAfterReadHookArgs
): CollectionAfterReadHook {
  return ({ doc, req, context, findMany }) => {
    if (!doc) return doc

    let mediaDoc = sanitizeMediaDocument(doc as SanityMediaDocument)
    mediaDoc = hydrateMediaOnRead(mediaDoc, args.cdnBaseUrl)

    if (args.localizedAltGroup) {
      mediaDoc = {
        ...mediaDoc,
        alt: normalizeLocalizedAltGroup(mediaDoc.alt, true) as SanityMediaDocument['alt'],
      }
    }

    const locale = req?.locale

    const shouldApplyNestedPopulate = shouldApplyDefaultPopulate({
      req,
      context,
      collectionSlug: args.collectionSlug,
      findMany,
      localPopulate: args.localPopulate,
    })

    if (
      shouldMorphMediaPopulate({
        context,
        configPreset: args.resolvedPreset,
        mediaCollectionSlug: args.collectionSlug,
        req,
        shouldApplyNestedPopulate,
      })
    ) {
      const shaped = applyPopulatePreset(mediaDoc, args.resolvedPreset, {
        cdnBaseUrl: args.cdnBaseUrl,
        locale,
        fallbackLocale: args.altFallbackLocale,
      })

      if (
        shaped !== mediaDoc &&
        shaped != null &&
        typeof shaped === 'object' &&
        !Array.isArray(shaped)
      ) {
        return shaped as typeof doc
      }
    }

    return mediaDoc as typeof doc
  }
}

const UPSTREAM_PRESERVE_KEYS = [
  'id',
  'type',
  'rev',
  'assetId',
  'path',
  'url',
  'extension',
  'sha1hash',
  'size',
  'mimeType',
  'originalFilename',
  'source',
  'media',
] as const satisfies readonly (keyof SanityUpstreamFields)[]

function mergeSanityUpstreamOnUpdate(
  incoming: SanityUpstreamFields | null | undefined,
  previous: SanityUpstreamFields | null | undefined
): SanityUpstreamFields | undefined {
  if (!previous) {
    return incoming ?? undefined
  }

  const merged: SanityUpstreamFields = { ...previous, ...incoming }

  for (const key of UPSTREAM_PRESERVE_KEYS) {
    const nextVal = incoming?.[key]
    const prevVal = previous[key]
    if ((nextVal == null || nextVal === '') && prevVal != null && prevVal !== '') {
      ;(merged as Record<typeof key, SanityUpstreamFields[typeof key]>)[key] = prevVal
    }
  }

  if (previous.metadata) {
    merged.metadata = {
      ...previous.metadata,
      ...incoming?.metadata,
    }
  }

  return merged
}

function hasIncomingUploadSizes(req: PayloadRequest): boolean {
  const sizes = req.payloadUploadSizes
  if (!sizes) return false
  return Object.values(sizes).some((buffer) => buffer != null && buffer.length > 0)
}

function clearStaleCloudStorageUploadContext(req: PayloadRequest): void {
  req.file = undefined
  req.payloadUploadSizes = undefined

  const context = req.context as Record<string, unknown> | undefined
  if (context?._payloadCloudStorage) {
    delete context._payloadCloudStorage
  }
}

/**
 * Runs last in `beforeChange`: keeps upstream Sanity fields on metadata-only saves and
 * prevents cloud-storage from re-uploading when no new file bytes are present.
 */
function requestWithoutUploadEdits(req: PayloadRequest): PayloadRequest {
  if (req.query?.uploadEdits == null) {
    return req
  }
  const query = { ...req.query }
  delete query.uploadEdits
  return { ...req, query }
}

/** Persists top-level `url` / dimensions before Payload fetches the file for crop (uses `originalDoc`). */
export function createSanityMediaEnsureCropSourceUrlBeforeOperationHook(options?: {
  cdnBaseUrl?: string
}): CollectionBeforeOperationHook {
  return async ({ args, collection, operation, req }) => {
    if (operation !== 'update') {
      return args
    }
    if (!getUploadEditsFromRequest(req)) {
      return args
    }
    if (!collection.upload) {
      return args
    }
    const rawId = 'id' in args ? (args as { id: unknown }).id : undefined
    if (rawId == null || rawId === '') {
      return args
    }
    if (typeof rawId !== 'string' && typeof rawId !== 'number') {
      return args
    }
    const id = rawId

    const doc = (await req.payload.findByID({
      collection: collection.slug,
      id,
      depth: 0,
      overrideAccess: true,
      req,
    })) as SanityMediaDocument | undefined

    if (!doc) {
      return args
    }

    if (
      !uploadEditsRequireBytesReupload(getUploadEditsFromRequest(req), {
        docWidth: doc.width,
        docHeight: doc.height,
      })
    ) {
      return args
    }

    const hasTopLevelUrl = typeof doc.url === 'string' && doc.url.trim().length > 0
    const widthOk = typeof doc.width === 'number' && doc.width > 0
    const heightOk = typeof doc.height === 'number' && doc.height > 0

    if (hasTopLevelUrl && widthOk && heightOk) {
      return args
    }

    const patch: Record<string, unknown> = {}
    if (!hasTopLevelUrl) {
      const publicUrl = resolvePublicUrl(doc, { cdnBaseUrl: options?.cdnBaseUrl })
      if (publicUrl) {
        patch.url = publicUrl
      }
    }

    const dimensions = doc.sanity?.metadata?.dimensions
    if (!widthOk && dimensions?.width != null) {
      patch.width = dimensions.width
    }
    if (!heightOk && dimensions?.height != null) {
      patch.height = dimensions.height
    }

    if (Object.keys(patch).length === 0) {
      return args
    }

    await req.payload.update({
      collection: collection.slug,
      id,
      data: patch as Record<string, unknown>,
      depth: 0,
      overrideAccess: true,
      context: {
        ...req.context,
        skipCloudStorage: true,
      },
      req: requestWithoutUploadEdits(req),
    })

    return args
  }
}

export function createSanityMediaPersistUpstreamBeforeChangeHook(): CollectionBeforeChangeHook {
  return ({ data, operation, originalDoc, req }) => {
    if (!data || operation !== 'update') {
      return data
    }

    if (isCloudStorageUpstreamMetadataUpdate(req, data)) {
      return data
    }

    const focalOnly = isFocalOnlyUploadEdits(req, { data, originalDoc })
    const bytesReprocess = uploadEditsRequireBytesReuploadFromRequest(req, {
      data,
      originalDoc,
    })
    const hasNewBytes = Boolean(req.file?.data?.length)
    const hasSizes = hasIncomingUploadSizes(req)
    let hasIncomingFile = hasNewBytes || hasSizes || bytesReprocess

    if (focalOnly) {
      hasIncomingFile = false
    }

    if (!hasIncomingFile) {
      clearStaleCloudStorageUploadContext(req)
      if (!req.context) {
        req.context = {}
      }
      req.context.skipCloudStorage = true
    } else {
      if (!req.context) {
        req.context = {}
      }
      req.context[SANITY_MEDIA_REPROCESS_CONTEXT_KEY] = true

      const ctx = req.context as { _payloadCloudStorage?: { file?: PayloadRequest['file'] } }
      if (!hasNewBytes && ctx?._payloadCloudStorage?.file?.data?.length) {
        req.file = ctx._payloadCloudStorage.file
      }
    }

    const previous = originalDoc as SanityMediaDocument | undefined
    if (!previous) {
      return data
    }

    let next = data as SanityMediaDocument

    if (!hasIncomingFile) {
      const mergedSanity = mergeSanityUpstreamOnUpdate(
        data.sanity as SanityUpstreamFields | undefined,
        previous.sanity
      )

      if (mergedSanity) {
        next = { ...next, sanity: mergedSanity }
      }

      const scalarFileFields = [
        'filename',
        'mimeType',
        'filesize',
        'width',
        'height',
        'focalX',
        'focalY',
        'prefix',
      ] as const
      for (const key of scalarFileFields) {
        const nextVal = next[key]
        const prevVal = previous[key]
        if ((nextVal == null || nextVal === '') && prevVal != null && prevVal !== '') {
          next = { ...next, [key]: prevVal }
        }
      }

      if (next.sizes == null && previous.sizes != null) {
        next = { ...next, sizes: previous.sizes }
      }
    }

    if (data.sync?.status == null && previous.sync?.status != null) {
      next = {
        ...next,
        sync: {
          ...readMediaSync(previous),
          ...readMediaSync(next),
        },
      }
    }

    return next as typeof data
  }
}

function documentHasMediaFields(doc: SanityMediaDocument): boolean {
  return (
    Boolean(doc.sanity?.id?.trim()) ||
    hasUpstreamLocators(doc) ||
    Boolean(doc.filename && doc.filename.trim().length > 0)
  )
}

/**
 * Payload runs collection `afterRead` before `afterChange`. Cloud-storage uploads in
 * `afterChange`, so the API response can still carry a stale `thumbnailURL` from the
 * pre-upload read. Re-hydrate after reprocess / asset replacement.
 */
export function createSanityMediaHydrateResponseAfterChangeHook(options?: {
  cdnBaseUrl?: string
}): CollectionAfterChangeHook {
  return ({ doc, operation, previousDoc, req }) => {
    if (!doc || operation !== 'update' || req.context?.skipCloudStorage) {
      return doc
    }

    const reprocessFlag = Boolean(req.context?.[SANITY_MEDIA_REPROCESS_CONTEXT_KEY])
    const reprocessQuery = uploadEditsRequireBytesReuploadFromRequest(req, {
      originalDoc: previousDoc as { width?: unknown; height?: unknown } | undefined,
    })
    const previousAssetId = sanityAssetIdFromDocument(
      (previousDoc ?? {}) as SanityAssetIdCarrier
    )
    const nextAssetId = sanityAssetIdFromDocument(doc as SanityAssetIdCarrier)
    const assetReplaced = Boolean(
      previousAssetId && nextAssetId && previousAssetId !== nextAssetId
    )

    if (!reprocessFlag && !reprocessQuery && !assetReplaced) {
      return doc
    }

    if (req.context) {
      delete req.context[SANITY_MEDIA_REPROCESS_CONTEXT_KEY]
    }

    const hydrated = hydrateMediaOnRead(
      sanitizeMediaDocument(doc as SanityMediaDocument),
      options?.cdnBaseUrl
    )

    return {
      ...doc,
      ...hydrated,
    } as typeof doc
  }
}

export type CreateSanityMediaBeforeChangeHookArgs = {
  localizedAltGroup?: boolean
}

export function createSanityMediaBeforeChangeHook(
  args: CreateSanityMediaBeforeChangeHookArgs = {}
): CollectionBeforeChangeHook {
  return ({ data, operation, originalDoc }) => {
    if (!data) return data

    let mediaData = data as SanityMediaDocument

    if (args.localizedAltGroup) {
      mediaData = {
        ...mediaData,
        alt: normalizeLocalizedAltGroup(mediaData.alt, true) as SanityMediaDocument['alt'],
      }
    }
    const previous = originalDoc as SanityMediaDocument | undefined
    const hasMedia =
      documentHasMediaFields(mediaData) ||
      (operation === 'update' && previous != null && documentHasMediaFields(previous))

    if (!hasMedia) {
      return data
    }

    const priorSync = operation === 'update' && previous ? readMediaSync(previous) : {}
    const sync = { ...priorSync, ...readMediaSync(mediaData as WithMediaSync) }
    const rawStatus = sync.status
    const status = rawStatus
      ? normalizeSyncStatus(rawStatus)
      : operation === 'create'
        ? 'available'
        : priorSync.status
          ? normalizeSyncStatus(priorSync.status)
          : 'available'
    const checkedAt = sync.checkedAt ?? new Date().toISOString()

    const slugifiedOriginalFilename =
      mediaData.originalFilename && mediaData.originalFilename.trim().length > 0
        ? slugifyFilename(mediaData.originalFilename)
        : mediaData.originalFilename

    const result = {
      ...mediaData,
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
