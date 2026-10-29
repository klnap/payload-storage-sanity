import type { PayloadRequest, Where } from 'payload'

import { isPayloadDocumentId, type PayloadDocumentId } from '@/core/contracts'

export type MediaRowBySanityAsset = {
  id: PayloadDocumentId
}

/** First media row pointing at a Sanity asset `_id` (excluding optional document id). */
export async function findMediaBySanityAssetId(
  req: PayloadRequest,
  collectionSlug: string,
  sanityAssetId: string,
  excludeId?: PayloadDocumentId | null
): Promise<MediaRowBySanityAsset | null> {
  const where: Where =
    excludeId != null
      ? {
          and: [
            { 'sanity.asset._id': { equals: sanityAssetId } },
            { id: { not_equals: excludeId } },
          ],
        }
      : {
          'sanity.asset._id': { equals: sanityAssetId },
        }

  const result = await req.payload.find({
    collection: collectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where,
  })

  const doc = result.docs[0]
  if (doc == null || !isPayloadDocumentId(doc.id)) return null
  return { id: doc.id }
}
