import type { ComponentType, ReactNode } from 'react'
import type { MediaImageAsset } from '@/consumers/assets'
import type { SanityImageAssetMapping } from '@/consumers/image/resolveMappedPopulateAsset'
import { SanityImage, type SanityImageProps } from './SanityImage'

export type CreateSanityImageOptions<TAsset extends object = MediaImageAsset> = {
  /** Default visual fallback when `asset`/`url` is missing or CDN load fails. `null` disables. */
  fallback?: ReactNode | null
  /** Default field mapping for every instance (overridable per render via `assetMapping`). */
  assetMapping?: SanityImageAssetMapping<TAsset>
}

/** Factory for app-wide default fallback and optional asset field mapping. */
export function createSanityImage<TAsset extends object = MediaImageAsset>(
  options: CreateSanityImageOptions<TAsset> = {}
): ComponentType<SanityImageProps<TAsset>> {
  const defaultFallback = options.fallback
  const defaultAssetMapping = options.assetMapping

  return Object.assign(
    function sanityImageWithDefaults({
      fallback,
      assetMapping,
      ...props
    }: SanityImageProps<TAsset>) {
      const resolvedFallback = fallback === undefined ? defaultFallback : fallback
      const resolvedAssetMapping = assetMapping ?? defaultAssetMapping

      return (
        <SanityImage
          {...props}
          assetMapping={resolvedAssetMapping as SanityImageAssetMapping<TAsset>}
          fallback={resolvedFallback}
        />
      )
    },
    { displayName: 'SanityImage' }
  )
}
