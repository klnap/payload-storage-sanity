/** Flat DTO for successfully normalized populated media relationships. */
export type DefaultPopulateAsset = {
  id: string | number
  url: string
  /** Image metadata, present when the Sanity asset provides it. */
  width?: number
  height?: number
  aspectRatio?: number
  /** Always present: 50 when the asset has no focal point. */
  focalX: number
  focalY: number
  /** Resolved for request locale; `null` when missing or empty (always present on preset `default`). */
  alt: string | null
  lqip?: string
}

function isFiniteOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}

/** Narrows an API relationship to a normalized asset returned by populate preset `default`. */
export function isDefaultPopulateAsset(value: unknown): value is DefaultPopulateAsset {
  if (value == null || typeof value !== 'object') return false
  const asset = value as Record<string, unknown>
  return (
    (typeof asset.id === 'string' || (typeof asset.id === 'number' && Number.isFinite(asset.id))) &&
    typeof asset.url === 'string' &&
    asset.url.trim().length > 0 &&
    typeof asset.focalX === 'number' &&
    Number.isFinite(asset.focalX) &&
    typeof asset.focalY === 'number' &&
    Number.isFinite(asset.focalY) &&
    (typeof asset.alt === 'string' || asset.alt === null) &&
    isFiniteOptionalNumber(asset.width) &&
    isFiniteOptionalNumber(asset.height) &&
    isFiniteOptionalNumber(asset.aspectRatio) &&
    (asset.lqip === undefined || typeof asset.lqip === 'string')
  )
}
