import type { SanityClient } from '@sanity/client'
import type { CollectionAfterChangeHook } from 'payload'
import { isPayloadDocumentId } from '@/core/contracts'
import type { SanityAssetIdCarrier } from '@/features/media/document'
import { deleteReplacedSanityAsset } from '@/features/media/lifecycle/update'
import { sanityAssetIdFromDocument } from '@/features/media/storage-adapter'

/** Runs after cloud-storage upload so replaced Sanity assets are deleted even when filename is unchanged. */
export function createMediaReplaceSanityAssetAfterChangeHook(
  client: SanityClient
): CollectionAfterChangeHook {
  return async ({ collection, doc, operation, previousDoc, req }) => {
    if (operation !== 'update' || req.context?.skipCloudStorage) {
      return doc
    }

    const previousAssetId = sanityAssetIdFromDocument(
      // SAFETY: previousDoc may be partial during media replace hook
      (previousDoc ?? {}) as SanityAssetIdCarrier
    )
    // SAFETY: afterChange doc is a media row with sanity.asset
    const nextAssetId = sanityAssetIdFromDocument(doc as SanityAssetIdCarrier)

    const mediaId = doc != null && 'id' in doc && isPayloadDocumentId(doc.id) ? doc.id : undefined

    await deleteReplacedSanityAsset(client, previousAssetId, nextAssetId, {
      payload: req.payload,
      collectionSlug: collection.slug,
      mediaId,
      req,
    })

    return doc
  }
}
