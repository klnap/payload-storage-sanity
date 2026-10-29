import type { SanityMediaDocument } from '@/features/media/document/sanityStorageDocument'
import { getSanityAssetFromMedia, getSanityAssetId } from '@/sanity/assets'

export type SanityAssetMediaKind = 'image' | 'file' | 'unknown'

/** Classifies a media row's Sanity asset for URL / CDN decisions (image transforms vs file). */
export function classifySanityAssetType(doc: SanityMediaDocument): SanityAssetMediaKind {
  const asset = getSanityAssetFromMedia(doc)
  const type = asset?._type
  if (type === 'sanity.imageAsset') {
    return 'image'
  }
  if (type === 'sanity.fileAsset') {
    return 'file'
  }

  const mimeType = asset?.mimeType
  if (typeof mimeType === 'string' && mimeType.startsWith('image/')) {
    return 'image'
  }

  const path = typeof asset?.path === 'string' ? asset.path : ''
  const id = getSanityAssetId(doc) ?? ''
  if (path.includes('-jpg') || path.includes('-png') || id.startsWith('image-')) {
    return 'image'
  }

  return 'unknown'
}
