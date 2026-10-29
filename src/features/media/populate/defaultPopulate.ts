/** Flat DTO for populate preset `default` (REST populated relations). */
export type DefaultPopulateAsset = {
  id: string | number
  url: string
  width?: number
  height?: number
  aspectRatio?: number
  focalX?: number
  focalY?: number
  /** Resolved for request locale; `null` when missing or empty (always present on preset `default`). */
  alt: string | null
  lqip?: string
}

export const SANITY_ASSET_DEFAULT_POPULATE_FIELDS = [
  'id',
  'url',
  'width',
  'height',
  'aspectRatio',
  'focalX',
  'focalY',
  'alt',
  'lqip',
] as const
