export type { MediaAsset } from '@/consumers/assets'
export type {
  SanityImageAssetMapping,
  SanityImageAssetPath,
} from '@/consumers/image/resolveMappedPopulateAsset'
export { type CreateSanityImageOptions, createSanityImage } from './SanityImage/createSanityImage'
export { SanityImage, type SanityImageProps } from './SanityImage/SanityImage'
export {
  type CreateSanityImageLoaderOptions,
  createSanityImageLoader,
  sanityImageLoader,
} from './sanityImageLoader'
