import type { CollectionAfterReadHook, CollectionBeforeChangeHook, PayloadRequest } from 'payload'

import { applyPopulatePreset } from '../populate/applyPopulatePreset'
import { presetUsesDefaultPopulate } from '../populate/presets'
import type { SanityMediaPopulatePresetRegistry } from '../populate/presets'
import { shouldApplyDefaultPopulate } from '../populate/shouldApplyDefaultPopulate'
import { isUnavailableSyncStatus, normalizeSyncStatus } from '../sync/status'
import type { SanityMediaDocument, SanityUpstreamFields } from '../types/sanityStorageDocument'
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

  const merged: SanityUpstreamFields = { ...previous, ...(incoming ?? {}) }

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
      ...(incoming?.metadata ?? {}),
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
export function createSanityMediaPersistUpstreamBeforeChangeHook(): CollectionBeforeChangeHook {
  return ({ data, operation, originalDoc, req }) => {
    if (!data || operation !== 'update') {
      return data
    }

    const hasNewBytes = Boolean(req.file?.data?.length)
    const hasSizes = hasIncomingUploadSizes(req)

    if (!hasNewBytes && !hasSizes) {
      clearStaleCloudStorageUploadContext(req)
      if (!req.context) {
        req.context = {}
      }
      req.context.skipCloudStorage = true
    }

    const previous = originalDoc as SanityMediaDocument | undefined
    if (!previous) {
      return data
    }

    const mergedSanity = mergeSanityUpstreamOnUpdate(
      data.sanity as SanityUpstreamFields | undefined,
      previous.sanity
    )

    let next = data as SanityMediaDocument

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

export function createSanityMediaBeforeChangeHook(): CollectionBeforeChangeHook {
  return ({ data, operation, originalDoc }) => {
    if (!data) return data

    const mediaData = data as SanityMediaDocument
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
