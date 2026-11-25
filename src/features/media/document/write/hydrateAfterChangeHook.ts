import type { CollectionAfterChangeHook } from 'payload'
import type { SanityAssetIdCarrier, SanityMediaDocument } from '@/features/media/document'
import { hydrateMediaOnRead, SANITY_MEDIA_REPROCESS_CONTEXT_KEY } from '@/features/media/document'
import { uploadEditsRequireBytesReuploadFromRequest } from '@/features/media/lifecycle/update'
import { sanityAssetIdFromDocument } from '@/features/media/storage-adapter'
import { sanitizeMediaDocument } from '../sanitizeDocument'

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
    const previousAssetId = sanityAssetIdFromDocument((previousDoc ?? {}) as SanityAssetIdCarrier)
    const nextAssetId = sanityAssetIdFromDocument(doc as SanityAssetIdCarrier)
    const assetReplaced = Boolean(previousAssetId && nextAssetId && previousAssetId !== nextAssetId)

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
