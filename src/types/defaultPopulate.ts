/** Flat DTO for populate preset `default` (REST populated relations). */
export type DefaultPopulateAsset = {
  id: number | string
  url: string
  width?: number
  height?: number
  aspectRatio?: number
  focalX?: number
  focalY?: number
  alt?: string
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
