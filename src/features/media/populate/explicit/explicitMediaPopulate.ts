import type { PayloadRequest } from 'payload'

function isPopulateFieldMap(value: unknown): boolean {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * True when the client passed an explicit Payload `populate[collectionSlug]` object for this request.
 * Shallow `select: { image: true }` does not set this — morph to `DefaultPopulateAsset` still applies.
 */
export function hasExplicitMediaPopulateSelect(
  req: PayloadRequest | undefined,
  mediaCollectionSlug: string
): boolean {
  if (!req?.query || !mediaCollectionSlug) {
    return false
  }

  const populate = req.query.populate
  if (!isPopulateFieldMap(populate)) {
    return false
  }

  const mediaPopulate = (populate as Record<string, unknown>)[mediaCollectionSlug]
  if (!isPopulateFieldMap(mediaPopulate)) {
    return false
  }

  return Object.keys(mediaPopulate as Record<string, unknown>).length > 0
}
