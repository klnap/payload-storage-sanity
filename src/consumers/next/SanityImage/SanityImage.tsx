import type Image from 'next/image'
import type { ComponentProps, ReactNode } from 'react'
import type { MediaImageAsset } from '@/consumers/assets'
import { isMediaImageAsset } from '@/consumers/assets'
import { resolveSanityImagePopulatedAsset, type SanityImageAssetMapping } from '@/consumers/image'
import { type ToSanityImagePropsOptions, toSanityImageProps } from '../toSanityImageProps'
import { resolveSanityImageFallback } from './resolveSanityImageFallback'
import { SanityImageClient } from './SanityImageClient'

type NextImageProps = ComponentProps<typeof Image>

/** Set on `<Image />` from `toSanityImageProps(asset)` — not accepted as raw overrides */
type AssetDerivedImageProp =
  | 'src'
  | 'alt'
  | 'width'
  | 'height'
  | 'fill'
  | 'style'
  | 'placeholder'
  | 'blurDataURL'

/** Custom asset shapes need an explicit mapping; only narrowed image assets skip it. */
type AssetMappingProps<TAsset extends object> = [TAsset] extends [MediaImageAsset]
  ? { assetMapping?: SanityImageAssetMapping<TAsset> }
  : { assetMapping: SanityImageAssetMapping<TAsset> }

export type SanityImageProps<TAsset extends object = MediaImageAsset> = {
  asset: TAsset | null | undefined
  /** Shown when asset/url is missing or when the image fails to load. `null` disables fallback. */
  fallback?: ReactNode | null
  /** Alias for Next.js `priority` */
  preload?: boolean
} & ToSanityImagePropsOptions &
  AssetMappingProps<TAsset> &
  Omit<NextImageProps, AssetDerivedImageProp | keyof ToSanityImagePropsOptions | 'fallback'>

export function SanityImage<TAsset extends object = MediaImageAsset>({
  asset,
  assetMapping,
  fallback,
  alt,
  fallbackAlt,
  fill,
  disableFocal,
  disablePlaceholder,
  placeholderFallback,
  cdnBaseUrl,
  preload,
  priority,
  ...imageProps
}: SanityImageProps<TAsset>) {
  const populatedAsset = resolveSanityImagePopulatedAsset(
    asset,
    assetMapping as SanityImageAssetMapping<object> | undefined
  )
  const imageAsset = isMediaImageAsset(populatedAsset) ? populatedAsset : null

  const derived = toSanityImageProps(imageAsset, {
    alt,
    fallbackAlt,
    fill,
    disableFocal,
    disablePlaceholder,
    placeholderFallback,
    cdnBaseUrl,
  })

  if (!derived) {
    return resolveSanityImageFallback('missing', { fallback, asset: populatedAsset }) ?? null
  }

  return (
    <SanityImageClient
      derived={derived}
      asset={imageAsset}
      fallback={fallback}
      preload={preload}
      priority={priority}
      {...imageProps}
    />
  )
}
