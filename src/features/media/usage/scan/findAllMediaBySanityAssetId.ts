import type { CollectionSlug, Payload } from 'payload'

import { isPayloadDocumentId, type PayloadDocumentId } from '@/core/contracts'

const PAGE_SIZE = 100

type FindSanityAssetReferencesArgs = {
  payload: Payload
  collectionSlug: string
  collectionSlugs?: readonly string[]
  sanityAssetId: string
  req?: Parameters<Payload['find']>[0]['req']
}

function resolveCollectionSlugs(
  collectionSlug: string,
  collectionSlugs?: readonly string[]
): readonly string[] {
  const slugs = collectionSlugs ?? [collectionSlug]
  if (slugs.length === 0 || slugs.some((slug) => !slug.trim())) {
    throw new Error('At least one media collection slug is required to verify asset references.')
  }
  return slugs
}

function assetQuery(
  slug: string,
  assetId: string,
  page: number,
  req?: FindSanityAssetReferencesArgs['req']
) {
  return {
    collection: slug as CollectionSlug,
    depth: 0 as const,
    limit: PAGE_SIZE,
    page,
    pagination: true as const,
    overrideAccess: true as const,
    where: {
      'sanity.asset._id': {
        equals: assetId,
      },
    },
    draft: true,
    req,
  }
}

/** Finds all media rows for a Sanity asset id (paginated). */
export async function findAllMediaBySanityAssetId({
  payload,
  collectionSlug,
  collectionSlugs,
  sanityAssetId,
  req,
}: FindSanityAssetReferencesArgs): Promise<
  Array<{ id: PayloadDocumentId; collectionSlug: string }>
> {
  const assetId = (sanityAssetId ?? '').trim()
  if (!assetId) return []
  const slugs = resolveCollectionSlugs(collectionSlug, collectionSlugs)
  const matches: Array<{ id: PayloadDocumentId; collectionSlug: string }> = []

  for (const slug of slugs) {
    let page = 1
    let hasNextPage = true

    while (hasNextPage) {
      const result = await payload.find(assetQuery(slug, assetId, page, req))

      for (const doc of result.docs) {
        if (isPayloadDocumentId(doc.id)) {
          matches.push({ id: doc.id, collectionSlug: slug })
        }
      }

      hasNextPage = result.hasNextPage === true
      page += 1
    }
  }

  return matches
}
