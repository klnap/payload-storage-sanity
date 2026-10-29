import type { PayloadRequest } from 'payload'

import { isPayloadDocumentId, type PayloadDocumentId } from '@/core/contracts'

export type MediaRowWithHash = {
  id: PayloadDocumentId
}

/**
 * Find an existing media row for identical bytes.
 * Prefer `sanity.asset.sha1hash`; fall back to `filename` containing the hash
 * (Sanity ids look like `image-{sha1}-{WxH}-{ext}`).
 */
export async function findMediaByContentHash(
  req: PayloadRequest,
  collectionSlug: string,
  contentHash: string
): Promise<MediaRowWithHash | null> {
  const byHash = await req.payload.find({
    collection: collectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      'sanity.asset.sha1hash': {
        equals: contentHash,
      },
    },
  })

  const hashDoc = byHash.docs[0]
  if (hashDoc != null && isPayloadDocumentId(hashDoc.id)) {
    return { id: hashDoc.id }
  }

  // JSON path queries can miss on some DB adapters; Sanity asset ids embed the sha1.
  const byFilename = await req.payload.find({
    collection: collectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      filename: {
        contains: contentHash,
      },
    },
  })

  const filenameDoc = byFilename.docs[0]
  if (filenameDoc != null && isPayloadDocumentId(filenameDoc.id)) {
    return { id: filenameDoc.id }
  }

  return null
}
