import type { PayloadRequest } from 'payload'

export type MediaRowWithHash = {
  id: number
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
      'sanity.sha1hash': {
        equals: contentHash,
      },
    },
  })

  const doc = result.docs[0]
  if (doc == null || !('id' in doc) || doc.id == null) return null
  return doc as MediaRowWithHash
}
