export type {
  SanityImageAssetMapping,
  SanityImageAssetPath,
} from '@/consumers/image/resolveMappedPopulateAsset'
export type { SanityAssetReference } from '@/sanity/assets/asset'
export type { DefaultPopulateAsset } from './assets'
export { isDefaultPopulateAsset } from './assets'
export {
  type BuildSanityImageUrlOptions,
  buildSanityImageUrl,
  type SanityImageSource,
} from './buildSanityImageUrl'
