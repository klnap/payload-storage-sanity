import { isUnavailableSyncStatus, normalizeSyncStatus } from '../sync/status'
import type { SanityImageDimensions } from '../types/asset'
import type { SanityMediaDocument } from '../types/sanityStorageDocument'

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
    media.sanity?.path?.trim() || media.sanity?.url?.trim() || media.url?.trim()
  )

  return hasUpstream
}

export function imageDimensionsFromMedia(
  media: Partial<SanityMediaDocument> | null | undefined
): SanityImageDimensions | null {
  if (media == null) return null

  const meta = media.sanity?.metadata?.dimensions
  if (meta && Number.isFinite(meta.width) && Number.isFinite(meta.height)) {
    return meta
  }

  if (
    media.width != null &&
    media.height != null &&
    Number.isFinite(media.width) &&
    Number.isFinite(media.height)
  ) {
    return {
      width: media.width,
      height: media.height,
      aspectRatio: media.width / media.height,
    }
  }

  return null
}
