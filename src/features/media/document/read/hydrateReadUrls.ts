import { resolveHydratedMediaUrls } from '@/features/media/cdn'
import type { SanityMediaDocument } from '@/features/media/document'

export function hydrateMediaOnRead(
  doc: SanityMediaDocument,
  cdnBaseUrl?: string
): SanityMediaDocument {
  const { url, thumbnailURL } = resolveHydratedMediaUrls(doc, cdnBaseUrl)

  return {
    ...doc,
    url,
    thumbnailURL,
  }
}
