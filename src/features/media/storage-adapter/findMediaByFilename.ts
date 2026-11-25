import type { PayloadRequest } from 'payload'

import { isPayloadDocumentId, type PayloadDocumentId } from '@/core/contracts'

export type MediaRowByFilename = {
  id: PayloadDocumentId
}

/** Lookup by Payload upload `filename` (legacy rows may still use Sanity asset `_id`). */
export async function findMediaByFilename(
  req: PayloadRequest,
  collectionSlug: string,
  filename: string
): Promise<MediaRowByFilename | null> {
  const result = await req.payload.find({
    collection: collectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      filename: {
        equals: filename,
      },
    },
  })

  const doc = result.docs[0]
  if (doc == null || !isPayloadDocumentId(doc.id)) return null
  return { id: doc.id }
}
