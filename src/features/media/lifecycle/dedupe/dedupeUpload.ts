import type {
  CollectionAfterOperationHook,
  CollectionBeforeChangeHook,
  PayloadRequest,
} from 'payload'
import {
  isPayloadDocumentId,
  type PayloadDocumentId,
  payloadDocumentIdsEqual,
} from '@/core/contracts'
import { hashFileContent } from './contentHash'
import { throwDuplicateUploadAPIError } from './duplicateUploadError'
import { findMediaByContentHash } from './findMediaByContentHash'
import { withContentHashLock } from './hashLock'

export const SANITY_STORAGE_DEDUPE_CONTEXT_KEY = '_sanityStorageDedupe' as const

/**
 * Soft-coupled with `@klnap/payload-hooks` localized-delete confirmation.
 * Set on internal orphan cleanup so `requireLocalizedDeleteConfirmation` does not block.
 */
export const LOCALIZED_DELETE_CONFIRMED_CONTEXT_KEY = 'localizedDeleteConfirmed' as const

export type SanityStorageDedupeContext = {
  existingId: PayloadDocumentId
}

type CloudStorageContext = {
  file?: { data?: Buffer }
}

type PayloadCloudStorageContext = {
  _payloadCloudStorage?: CloudStorageContext
}

/** Bytes Payload / cloud-storage attached to this request (main file only). */
export function readUploadBufferFromRequest(req: PayloadRequest): Buffer | null {
  const fromReq = req.file?.data
  if (fromReq?.length) return fromReq

  // SAFETY: Payload request context may carry cloud-storage upload buffer metadata
  const cloudStorage = (req.context as PayloadCloudStorageContext | undefined)?._payloadCloudStorage
  const fromContext = cloudStorage?.file?.data
  if (fromContext?.length) return fromContext

  return null
}

export function createMediaDedupeBeforeChangeHook(
  collectionSlug: string
): CollectionBeforeChangeHook {
  return async ({ data, operation, req }) => {
    if (operation !== 'create') return data

    const buffer = readUploadBufferFromRequest(req)
    if (!buffer) return data

    const contentHash = hashFileContent(buffer)
    const existing = await withContentHashLock(contentHash, () =>
      findMediaByContentHash(req, collectionSlug, contentHash)
    )

    if (existing) {
      throwDuplicateUploadAPIError(req, existing.id)
    }

    const existingSanity =
      data != null && typeof data === 'object' && 'sanity' in data && data.sanity != null
        ? (data.sanity as Record<string, unknown>)
        : {}
    const existingAsset =
      existingSanity.asset != null && typeof existingSanity.asset === 'object'
        ? (existingSanity.asset as Record<string, unknown>)
        : {}

    return {
      ...data,
      sanity: {
        ...existingSanity,
        asset: {
          ...existingAsset,
          sha1hash: contentHash,
        },
      },
    }
  }
}

export function createMediaDedupeAfterOperationHook(
  collectionSlug: string
): CollectionAfterOperationHook {
  return async ({ operation, req, result }) => {
    if (operation !== 'create' || result == null) {
      return result
    }

    // SAFETY: set by handleUpload when Sanity returns an asset `_id` already used as `filename`
    const dedupe = req.context?.[SANITY_STORAGE_DEDUPE_CONTEXT_KEY] as
      | SanityStorageDedupeContext
      | undefined

    if (!dedupe?.existingId) return result

    const createdId = 'id' in result && isPayloadDocumentId(result.id) ? result.id : null
    if (createdId == null || payloadDocumentIdsEqual(createdId, dedupe.existingId)) return result

    await req.payload.delete({
      collection: collectionSlug,
      id: createdId,
      overrideAccess: true,
      context: {
        ...req.context,
        skipCloudStorage: true,
        // Internal dedupe cleanup — not an admin-initiated delete
        [LOCALIZED_DELETE_CONFIRMED_CONTEXT_KEY]: true,
      },
      req,
    })

    throwDuplicateUploadAPIError(req, dedupe.existingId)
  }
}
