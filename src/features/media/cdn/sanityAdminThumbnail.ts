import type { SanityMediaDocument } from '@/features/media/document/sanityStorageDocument'
import { resolvePublicUrl } from './resolvePublicUrl'

export type SanityAdminThumbnailOptions = {
  width?: number
  fit?: 'max' | 'min' | 'crop' | 'clip'
  cdnBaseUrl?: string
}

/** Sanity CDN width for Payload admin thumbs (gallery, Lexical uploads, relation cards). */
export const SANITY_ADMIN_THUMBNAIL_WIDTH = 960

export function sanityAdminThumbnail(
  doc: SanityMediaDocument,
  opts: SanityAdminThumbnailOptions = {}
): string | null {
  const width = opts.width ?? SANITY_ADMIN_THUMBNAIL_WIDTH
  return resolvePublicUrl(doc, {
    cdnBaseUrl: opts.cdnBaseUrl,
    transform: {
      width,
      fit: opts.fit ?? 'max',
      autoFormat: true,
    },
  })
}
