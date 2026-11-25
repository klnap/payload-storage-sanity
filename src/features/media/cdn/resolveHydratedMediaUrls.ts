import type { SanityMediaDocument } from '@/features/media/document/sanityStorageDocument'
import { deriveBaseCdnUrlFromThumbnail, isPersistedHttpUrl } from '@/sanity/cdn'
import { resolvePublicUrl } from './resolvePublicUrl'
import { sanityAdminThumbnail } from './sanityAdminThumbnail'

export { isPersistedHttpUrl } from '@/sanity/cdn'

export type ResolveHydratedMediaUrlsResult = {
  url: string | null
  thumbnailURL: string | null
}

/** Resolves storefront `url` / `thumbnailURL` without mutating the document. */
export function resolveHydratedMediaUrls(
  doc: SanityMediaDocument,
  cdnBaseUrl?: string
): ResolveHydratedMediaUrlsResult {
  const thumbnailURL =
    sanityAdminThumbnail(doc, { cdnBaseUrl }) ??
    (isPersistedHttpUrl(doc.thumbnailURL) ? doc.thumbnailURL : null)

  const url =
    resolvePublicUrl(doc, { cdnBaseUrl }) ??
    (isPersistedHttpUrl(doc.url) ? doc.url : null) ??
    deriveBaseCdnUrlFromThumbnail(thumbnailURL)

  return { url, thumbnailURL }
}
