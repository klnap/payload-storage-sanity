import type { DefaultPopulateAsset } from '@/features/media/populate'

/** Dot-separated path on the consumer asset (e.g. `metadata.width`). */
export type SanityImageAssetPath = string

/** Maps fields on a custom-populated asset to {@link DefaultPopulateAsset}. */
export type SanityImageAssetMapping<_TAsset extends object = object> = {
  /** Required when using a mapping; must resolve to a non-empty image URL string. */
  url: SanityImageAssetPath
  id?: SanityImageAssetPath
  width?: SanityImageAssetPath
  height?: SanityImageAssetPath
  aspectRatio?: SanityImageAssetPath
  focalX?: SanityImageAssetPath
  focalY?: SanityImageAssetPath
  alt?: SanityImageAssetPath
  lqip?: SanityImageAssetPath
}

function readPathValue(asset: object, path: SanityImageAssetPath): unknown {
  const segments = path.split('.').filter((segment) => segment.length > 0)
  let current: unknown = asset
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function pickString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function pickAlt(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function pickNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function pickId(value: unknown): string | number {
  if (typeof value === 'string' || typeof value === 'number') return value
  return ''
}

/**
 * Builds a {@link DefaultPopulateAsset} from `asset` using `mapping` without mutating `asset`.
 * Returns `null` when `asset` is missing or mapped `url` is absent/invalid (same contract as missing image data).
 */
export function resolveMappedPopulateAsset<TAsset extends object>(
  asset: TAsset | null | undefined,
  mapping: SanityImageAssetMapping<TAsset>
): DefaultPopulateAsset | null {
  if (asset == null) {
    return null
  }

  const url = pickString(readPathValue(asset, mapping.url))
  if (!url) {
    return null
  }

  const mapped: DefaultPopulateAsset = {
    id: mapping.id != null ? pickId(readPathValue(asset, mapping.id)) : '',
    url,
    alt: mapping.alt != null ? pickAlt(readPathValue(asset, mapping.alt)) : null,
  }

  if (mapping.width != null) {
    const width = pickNumber(readPathValue(asset, mapping.width))
    if (width != null) mapped.width = width
  }

  if (mapping.height != null) {
    const height = pickNumber(readPathValue(asset, mapping.height))
    if (height != null) mapped.height = height
  }

  if (mapping.aspectRatio != null) {
    const aspectRatio = pickNumber(readPathValue(asset, mapping.aspectRatio))
    if (aspectRatio != null) mapped.aspectRatio = aspectRatio
  }

  if (mapping.focalX != null) {
    const focalX = pickNumber(readPathValue(asset, mapping.focalX))
    if (focalX != null) mapped.focalX = focalX
  }

  if (mapping.focalY != null) {
    const focalY = pickNumber(readPathValue(asset, mapping.focalY))
    if (focalY != null) mapped.focalY = focalY
  }

  if (mapping.lqip != null) {
    const lqip = pickString(readPathValue(asset, mapping.lqip))
    if (lqip != null) mapped.lqip = lqip
  }

  return mapped
}

/** Applies optional mapping, or passes through a default-populated asset unchanged. */
export function resolveSanityImagePopulatedAsset<TAsset>(
  asset: TAsset | null | undefined,
  assetMapping?: SanityImageAssetMapping<object> | undefined
): DefaultPopulateAsset | null | undefined {
  if (!assetMapping) {
    return asset as DefaultPopulateAsset | null | undefined
  }

  return resolveMappedPopulateAsset(asset as object | null | undefined, assetMapping)
}
