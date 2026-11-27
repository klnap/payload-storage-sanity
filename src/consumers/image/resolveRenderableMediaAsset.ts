import type { MediaAsset } from '@/consumers/assets'
import { isSanityCompatibleHost } from '@/sanity/cdn'

const IMAGE_ASSET_PATH = /\.(avif|gif|jpe?g|png|svg|tiff?|webp)$/i

function isPositiveOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value > 0)
}

function isMediaAssetShape(value: unknown): value is MediaAsset {
  if (value == null || typeof value !== 'object') return false
  const id = Reflect.get(value, 'id')
  const url = Reflect.get(value, 'url')
  const focalX = Reflect.get(value, 'focalX')
  const focalY = Reflect.get(value, 'focalY')
  const alt = Reflect.get(value, 'alt')
  return (
    (typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id))) &&
    typeof url === 'string' &&
    url.trim().length > 0 &&
    typeof focalX === 'number' &&
    Number.isFinite(focalX) &&
    focalX >= 0 &&
    focalX <= 100 &&
    typeof focalY === 'number' &&
    Number.isFinite(focalY) &&
    focalY >= 0 &&
    focalY <= 100 &&
    (typeof alt === 'string' || alt === null) &&
    isPositiveOptionalNumber(Reflect.get(value, 'width')) &&
    isPositiveOptionalNumber(Reflect.get(value, 'height')) &&
    isPositiveOptionalNumber(Reflect.get(value, 'aspectRatio')) &&
    (Reflect.get(value, 'lqip') === undefined || typeof Reflect.get(value, 'lqip') === 'string')
  )
}

/** Internal fail-closed validation before passing media to Next Image. */
export function resolveRenderableMediaAsset(
  value: unknown,
  cdnBaseUrl?: string
): MediaAsset | null {
  try {
    if (!isMediaAssetShape(value)) return null
    const url = new URL(value.url)
    const segments = url.pathname.split('/').filter(Boolean)
    if (
      url.protocol !== 'https:' ||
      !isSanityCompatibleHost(value.url, { cdnBaseUrl }) ||
      !segments.includes('images') ||
      segments.includes('files') ||
      !IMAGE_ASSET_PATH.test(url.pathname)
    ) {
      return null
    }
    return value
  } catch {
    return null
  }
}
