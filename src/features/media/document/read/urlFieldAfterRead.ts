import type { FieldHook } from 'payload'
import { resolveHydratedMediaUrls } from '@/features/media/cdn'
import type { SanityMediaDocument } from '@/features/media/document'

export type CreateSanityMediaUrlFieldAfterReadHookArgs = {
  cdnBaseUrl?: string
}

/**
 * Runs after cloud-storage's `url` field hook so nested REST populate keeps a CDN `url`
 * (cloud-storage may return `''` when `sanity` is not in the selected shape).
 */
export function createSanityMediaUrlFieldAfterReadHook(
  args: CreateSanityMediaUrlFieldAfterReadHookArgs
): FieldHook {
  return ({ data, siblingData, value }) => {
    const doc = (siblingData ?? data) as SanityMediaDocument | undefined
    if (!doc) {
      return value
    }

    const { url } = resolveHydratedMediaUrls(doc, args.cdnBaseUrl)
    if (url) {
      return url
    }

    if (typeof value === 'string' && value.trim() !== '') {
      return value
    }

    return value ?? null
  }
}
