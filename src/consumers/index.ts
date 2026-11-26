export type {
  SanityImageAssetMapping,
  SanityImageAssetPath,
} from '@/consumers/image/resolveMappedPopulateAsset'
export type { SanityAssetReference } from '@/sanity/assets/asset'
export type { MediaAsset, MediaImageAsset } from './assets'
export { isMediaAsset, isMediaImageAsset } from './assets'
export {
  type BuildSanityImageUrlOptions,
  buildSanityImageUrl,
  type SanityImageSource,
} from './buildSanityImageUrl'
