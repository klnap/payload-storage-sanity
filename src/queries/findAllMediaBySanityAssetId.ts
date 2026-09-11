import type { CollectionSlug, Payload } from 'payload'

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
}): Promise<Array<{ id: number }>> {
  const matches: Array<{ id: number }> = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await payload.find({
      // SAFETY: collectionSlug is configured by the Sanity storage plugin
      collection: collectionSlug as CollectionSlug,
      depth: 0,
      limit: PAGE_SIZE,
      page,
      pagination: true,
      where: { sanity_id: { equals: sanityAssetId } },
      draft: true,
      req,
    })

    for (const doc of result.docs) {
      if (doc.id != null && Number.isFinite(doc.id)) {
        matches.push({ id: Number(doc.id) })
      }
    }

    hasNextPage = result.hasNextPage === true
    page += 1
  }

  return matches
}
