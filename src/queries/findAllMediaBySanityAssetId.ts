import type { CollectionSlug, Payload } from 'payload'

import {
  isPayloadDocumentId,
  type PayloadDocumentId,
} from '../utils/payloadDocumentId'

const PAGE_SIZE = 100

/** Finds all media rows for a Sanity asset id (paginated). */
export async function findAllMediaBySanityAssetId({
  payload,
  collectionSlug,
  sanityAssetId,
  req,
}: {
  payload: Payload
  collectionSlug: string
  sanityAssetId: string
  req?: Parameters<Payload['find']>[0]['req']
}): Promise<Array<{ id: PayloadDocumentId }>> {
  const matches: Array<{ id: PayloadDocumentId }> = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await payload.find({
      collection: collectionSlug as CollectionSlug,
      depth: 0,
      limit: PAGE_SIZE,
      page,
      pagination: true,
      overrideAccess: true,
      where: {
        'sanity.id': {
          equals: sanityAssetId,
        },
      },
      draft: true,
      req,
    })

    for (const doc of result.docs) {
      if (isPayloadDocumentId(doc.id)) {
        matches.push({ id: doc.id })
      }
    }

    hasNextPage = result.hasNextPage === true
    page += 1
  }

  return matches
}
