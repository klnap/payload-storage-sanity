export type { DefaultPopulateAsset } from '@/consumers/assets'

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
