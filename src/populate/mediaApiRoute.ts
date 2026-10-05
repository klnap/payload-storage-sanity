import type { PayloadRequest } from 'payload'

/** Payload REST segments after `/api/{collectionSlug}/` that are not document IDs. */
export const RESERVED_MEDIA_COLLECTION_REST_SEGMENTS = new Set(['versions', 'files', 'file'])

export function mediaApiPathSegments(req: PayloadRequest | undefined, collectionSlug: string): string[] | null {
  const url = req?.url
  if (!url) return null

  try {
    const pathname = new URL(url, 'http://localhost').pathname
    const segments = pathname.split('/').filter(Boolean)
    const apiIndex = segments.indexOf('api')
    if (apiIndex < 0) return null

    const rest = segments.slice(apiIndex + 1)
    if (rest[0] !== collectionSlug) return null

    return rest
  } catch {
    return null
  }
}

/** `GET /api/{media}/:id` (numeric, UUID, …) — admin document editor, not nested populate. */
export function isDirectMediaDocumentApiRequest(
  req: PayloadRequest | undefined,
  collectionSlug: string
): boolean {
  const rest = mediaApiPathSegments(req, collectionSlug)
  if (!rest || rest.length !== 2) return false

  const segment = rest[1] ?? ''
  return !RESERVED_MEDIA_COLLECTION_REST_SEGMENTS.has(segment)
}

/** `GET /api/{media}` collection list. */
export function isMediaCollectionListApiRequest(
  req: PayloadRequest | undefined,
  collectionSlug: string
): boolean {
  const rest = mediaApiPathSegments(req, collectionSlug)
  return rest != null && rest.length === 1
}

/** Payload admin list / edit for a collection (`find` + `findMany` use admin URLs, not `/api/{slug}`). */
export function isAdminCollectionRoute(
  req: PayloadRequest | undefined,
  collectionSlug: string
): boolean {
  const url = req?.url
  if (!url) return false

  try {
    const pathname = new URL(url, 'http://localhost').pathname
    const prefix = `/admin/collections/${collectionSlug}`
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  } catch {
    return false
  }
}
