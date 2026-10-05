import type { PayloadRequest } from 'payload'

export type ShouldApplyDefaultPopulateArgs = {
  req?: PayloadRequest
  context?: unknown
  collectionSlug?: string
  findMany?: boolean
}

/** Payload REST segments after `/api/{collectionSlug}/` that are not document IDs. */
const RESERVED_COLLECTION_REST_SEGMENTS = new Set(['versions', 'files', 'file'])

/**
 * True when media is returned as a populated relation over the **REST API** (`default` preset).
 * False for admin (`payloadAPI: 'local'`), direct `/api/{collection}` and `/api/{collection}/{id}`
 * (any id shape: UUID, numeric, etc.), and collection list routes.
 */
export function shouldApplyDefaultPopulate({
  req,
  context,
  collectionSlug,
}: ShouldApplyDefaultPopulateArgs): boolean {
  const ctx = context as Record<string, unknown> | undefined
  if (ctx?.sanitySkipDefaultPopulate === true) return false
  if (ctx?.sanityForceDefaultPopulate === true) return true

  if (req?.payloadAPI !== 'REST') {
    return false
  }

  const url = req?.url
  if (url && collectionSlug) {
    try {
      const pathname = new URL(url, 'http://localhost').pathname
      const segments = pathname.split('/').filter(Boolean)
      const apiIndex = segments.indexOf('api')
      if (apiIndex >= 0) {
        const rest = segments.slice(apiIndex + 1)
        if (rest[0] === collectionSlug) {
          if (rest.length === 1) {
            return false
          }
          if (rest.length === 2) {
            const segment = rest[1] ?? ''
            if (!RESERVED_COLLECTION_REST_SEGMENTS.has(segment)) {
              return false
            }
          }
        }
      }
    } catch {
      // ignore malformed URL
    }
  }

  return true
}
