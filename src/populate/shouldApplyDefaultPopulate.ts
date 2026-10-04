import type { PayloadRequest } from 'payload'

export type ShouldApplyDefaultPopulateArgs = {
  req?: PayloadRequest
  context?: unknown
  collectionSlug?: string
  findMany?: boolean
}

/**
 * True when media is returned as a populated relation over the **REST API** (`default` preset).
 * False for admin (`payloadAPI: 'local'`), direct `GET /api/{media}`, and collection `find`.
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
          if (rest.length === 2 && /^\d+$/.test(rest[1] ?? '')) {
            return false
          }
        }
      }
    } catch {
      // ignore malformed URL
    }
  }

  return true
}
