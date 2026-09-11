import type { PayloadRequest } from 'payload'

export type MediaRowWithHash = {
  id: number
  sha1hash?: string | null
}

export async function findMediaByContentHash(
  req: PayloadRequest,
  collectionSlug: string,
  contentHash: string
): Promise<MediaRowWithHash | null> {
  const result = await req.payload.find({
    collection: collectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      sha1hash: {
        equals: contentHash,
      },
    },
  })

  const doc = result.docs[0]
  if (doc == null || !('id' in doc) || doc.id == null) return null
  // SAFETY: doc returned from media find matches MediaRowWithHash
  return doc as MediaRowWithHash
}
