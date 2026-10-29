export type { DefaultPopulateAsset } from '@/features/media/populate'
export { focalObjectPosition } from '@/features/media/populate'
export type { SanityImageAssetMapping, SanityImageAssetPath } from '@/presentation/image'
export {
  type ResolveAssetAltOptions,
  type ResolvePlaceholderBlurDataUrlOptions,
  resolveAssetAlt,
  resolveMappedPopulateAsset,
  resolvePlaceholderBlurDataUrl,
  resolveSanityImagePopulatedAsset,
  SANITY_IMAGE_DEFAULT_BLUR_DATA_URL,
  type SanityCdnUrlOptions,
  sanityCdnUrl,
} from '@/presentation/image'
export { type CreateSanityImageOptions, createSanityImage } from './SanityImage/createSanityImage'
export {
  type ResolveSanityImageFallbackArgs,
  resolveSanityImageFallback,
  shouldUseSanityImageFallback,
} from './SanityImage/resolveSanityImageFallback'
export { SanityImage, type SanityImageProps } from './SanityImage/SanityImage'
export { SanityImageClient, type SanityImageClientProps } from './SanityImage/SanityImageClient'
export {
  SanityImageInteractive,
  type SanityImageInteractiveProps,
} from './SanityImage/SanityImageInteractive'
export {
  appendSanityCdnParams,
  type CreateSanityImageLoaderOptions,
  createSanityImageLoader,
  sanityImageLoader,
} from './sanityImageLoader'
export { type ToSanityImagePropsOptions, toSanityImageProps } from './toSanityImageProps'
