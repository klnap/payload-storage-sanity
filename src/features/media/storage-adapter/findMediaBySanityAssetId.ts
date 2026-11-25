import type { PayloadRequest, Where } from 'payload'

import { isPayloadDocumentId, type PayloadDocumentId } from '@/core/contracts'

export type MediaRowBySanityAsset = {
  /** Null when a row exists but the requester cannot read it; its id is never disclosed. */
  id: PayloadDocumentId | null
}

/** First media row pointing at a Sanity asset `_id` (excluding optional document id). */
export async function findMediaBySanityAssetId(
  req: PayloadRequest,
  collectionSlug: string,
  sanityAssetId: string,
  excludeId?: PayloadDocumentId | null
): Promise<MediaRowBySanityAsset | null> {
  const assetId = (sanityAssetId ?? '').trim()
  if (!assetId) return null
  const where: Where =
    excludeId != null
      ? {
          and: [{ 'sanity.asset._id': { equals: assetId } }, { id: { not_equals: excludeId } }],
        }
      : {
          'sanity.asset._id': { equals: sanityAssetId },
        }

  // Existence is checked privileged so the conflict is still rejected for unreadable rows.
  const existing = await req.payload.find({
    collection: collectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where,
  })

  if (existing.docs[0] == null) return null

  // Only a row the requester can read may be disclosed. The requester's own access applies even without
  // a user, so an anonymous request never receives the id of a row it cannot read.
  const readable = await req.payload.find({
    collection: collectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    req,
    where,
  })

  const doc = readable.docs[0]
  if (doc == null || !isPayloadDocumentId(doc.id)) return { id: null }
  return { id: doc.id }
}
