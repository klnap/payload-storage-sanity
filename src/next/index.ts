export type { DefaultPopulateAsset } from '../types/defaultPopulate'
export { focalObjectPosition } from '../utils/focalObjectPosition'
export { createSanityImage, type CreateSanityImageOptions } from './createSanityImage'
export { SanityImage, type SanityImageProps } from './SanityImage'
export { SanityImageClient, type SanityImageClientProps } from './SanityImageClient'
export {
  SanityImageInteractive,
  type SanityImageInteractiveProps,
} from './SanityImageInteractive'
export {
  resolveSanityImageFallback,
  shouldUseSanityImageFallback,
  type ResolveSanityImageFallbackArgs,
  type SanityImageFallbackProps,
  type SanityImageFallbackReason,
} from './resolveSanityImageFallback'
export {
  appendSanityCdnParams,
  createSanityImageLoader,
  sanityImageLoader,
} from './sanityImageLoader'
export { resolveAssetAlt } from './resolveAssetAlt'
export { sanityCdnUrl } from './sanityCdnUrl'
export { toSanityImageProps, type ToSanityImagePropsOptions } from './toSanityImageProps'
