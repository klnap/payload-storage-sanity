import { isUnavailableSyncStatus, normalizeSyncStatus } from '@/features/asset-sync/settings/status'
import type { SanityMediaDocument } from '@/features/media/document/sanityStorageDocument'
import type { SanityImageDimensions } from '@/sanity/assets'
import { getSanityAssetMetadata, getSanityAssetPath, getSanityAssetUrl } from '@/sanity/assets'

export function hasResolvableMediaUrl(
  media: Partial<SanityMediaDocument> | null | undefined
): boolean {
  if (media == null) return false
  return Boolean(media.url && media.url.trim().length > 0)
}

export function isMediaAssetAvailable(
  media: Partial<SanityMediaDocument> | null | undefined
): boolean {
  if (media == null) return false

  const status = normalizeSyncStatus(media.sync?.status)
  if (isUnavailableSyncStatus(status)) {
    return false
  }

  const hasUpstream = Boolean(
    getSanityAssetPath(media)?.trim() || getSanityAssetUrl(media)?.trim() || media.url?.trim()
  )

  return hasUpstream
}

export function imageDimensionsFromMedia(
  media: Partial<SanityMediaDocument> | null | undefined
): SanityImageDimensions | null {
  if (media == null) return null

  const meta = getSanityAssetMetadata(media)?.dimensions
  if (meta && Number.isFinite(meta.width) && Number.isFinite(meta.height)) {
    return meta
  }

  return null
}
