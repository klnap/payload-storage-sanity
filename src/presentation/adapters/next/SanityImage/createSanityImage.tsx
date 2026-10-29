import type { ComponentType, ReactNode } from 'react'
import type { DefaultPopulateAsset } from '@/features/media/populate'
import type { SanityImageAssetMapping } from '@/presentation/image'
import { SanityImage, type SanityImageProps } from './SanityImage'

export type CreateSanityImageOptions<TAsset extends object = DefaultPopulateAsset> = {
  /** Default visual fallback when `asset`/`url` is missing or CDN load fails. `null` disables. */
  fallback?: ReactNode | null
  /** Default field mapping for every instance (overridable per render via `assetMapping`). */
  assetMapping?: SanityImageAssetMapping<TAsset>
}

/** Factory for app-wide default fallback and optional asset field mapping. */
export function createSanityImage<TAsset extends object = DefaultPopulateAsset>(
  options: CreateSanityImageOptions<TAsset> = {}
): ComponentType<SanityImageProps<TAsset>> {
  const defaultFallback = options.fallback
  const defaultAssetMapping = options.assetMapping

  function SanityImageWithDefaults({ fallback, assetMapping, ...props }: SanityImageProps<TAsset>) {
    const resolvedFallback = fallback === undefined ? defaultFallback : fallback
    const resolvedAssetMapping = assetMapping ?? defaultAssetMapping

    return (
      <SanityImage {...props} assetMapping={resolvedAssetMapping} fallback={resolvedFallback} />
    )
  }

  SanityImageWithDefaults.displayName = 'SanityImage'

  return SanityImageWithDefaults
}
