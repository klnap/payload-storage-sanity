import type Image from 'next/image'
import type { ComponentProps, ReactNode } from 'react'
import type { DefaultPopulateAsset } from '@/features/media/populate'
import {
  resolveSanityImagePopulatedAsset,
  type SanityImageAssetMapping,
} from '@/presentation/image'
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

export type SanityImageProps<TAsset extends object = DefaultPopulateAsset> = {
  asset: TAsset | null | undefined
  /**
   * Maps a custom-populated asset to the default populate shape before image construction.
   * Omit when `asset` is already a {@link DefaultPopulateAsset}.
   */
  assetMapping?: SanityImageAssetMapping<TAsset>
  /** Shown when asset/url is missing or when the image fails to load. `null` disables fallback. */
  fallback?: ReactNode | null
  /** Alias for Next.js `priority` */
  preload?: boolean
} & ToSanityImagePropsOptions &
  Omit<NextImageProps, AssetDerivedImageProp | keyof ToSanityImagePropsOptions | 'fallback'>

export function SanityImage<TAsset extends object = DefaultPopulateAsset>({
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

  const derived = toSanityImageProps(populatedAsset, {
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
      asset={populatedAsset}
      fallback={fallback}
      preload={preload}
      priority={priority}
      {...imageProps}
    />
  )
}
