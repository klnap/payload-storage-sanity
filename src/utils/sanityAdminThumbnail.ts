import type { SanityMediaDocument } from '../types/sanityStorageDocument'
import { resolvePublicUrl } from './resolvePublicUrl'

export type SanityAdminThumbnailOptions = {
  width?: number
  fit?: 'max' | 'min' | 'crop' | 'clip'
  cdnBaseUrl?: string
}

export function sanityAdminThumbnail(
  doc: SanityMediaDocument,
  opts: SanityAdminThumbnailOptions = {}
): string | null {
  const width = opts.width ?? 300
  return resolvePublicUrl(doc, {
    cdnBaseUrl: opts.cdnBaseUrl,
    transform: {
      width,
      fit: opts.fit ?? 'max',
      autoFormat: true,
    },
  })
}
