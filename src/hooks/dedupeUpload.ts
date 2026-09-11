import type {
  CollectionAfterOperationHook,
  CollectionBeforeChangeHook,
  PayloadRequest,
} from 'payload'

import { findMediaByContentHash } from '../queries/findMediaByContentHash'
import { hashFileContent } from '../utils/crypto'
import { withContentHashLock } from '../utils/lock'

export const SANITY_STORAGE_DEDUPE_CONTEXT_KEY = '_sanityStorageDedupe' as const

export type SanityStorageDedupeContext = {
  existingId: number
}

type CloudStorageContext = {
  file?: { data?: Buffer }
}

type PayloadCloudStorageContext = {
  _payloadCloudStorage?: CloudStorageContext
}

function uploadBuffer(req: PayloadRequest): Buffer | null {
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

    const buffer = uploadBuffer(req)
    if (!buffer) return data

    const contentHash = hashFileContent(buffer)
    const existing = await withContentHashLock(contentHash, () =>
      findMediaByContentHash(req, collectionSlug, contentHash)
    )

    if (!req.context) {
      req.context = {}
    }

    if (existing) {
      req.context[SANITY_STORAGE_DEDUPE_CONTEXT_KEY] = { existingId: existing.id }
      req.context.skipCloudStorage = true
    }

    return {
      ...data,
      sha1hash: contentHash,
    }
  }
}

export function createMediaDedupeAfterOperationHook(
  collectionSlug: string
): CollectionAfterOperationHook {
  return async ({ args, operation, req, result }) => {
    if (operation !== 'create' || result == null) {
      return result
    }

    // SAFETY: dedupe context is written by the paired beforeChange hook
    const dedupe = req.context?.[SANITY_STORAGE_DEDUPE_CONTEXT_KEY] as
      | SanityStorageDedupeContext
      | undefined

    if (!dedupe?.existingId) return result

    const createdId =
      'id' in result && result.id != null && Number.isFinite(result.id) ? Number(result.id) : null
    if (createdId == null || createdId === dedupe.existingId) return result

    await req.payload.delete({
      collection: collectionSlug,
      id: createdId,
      overrideAccess: true,
      context: {
        ...req.context,
        skipCloudStorage: true,
      },
      req,
    })

    const existingDoc = await req.payload.findByID({
      collection: collectionSlug,
      depth: args.depth,
      id: dedupe.existingId,
      overrideAccess: true,
      disableErrors: true,
      req,
    })

    return existingDoc ?? result
  }
}
