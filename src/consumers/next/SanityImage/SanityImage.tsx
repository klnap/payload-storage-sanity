import type Image from 'next/image'
import type { ComponentProps, ReactNode } from 'react'
import type { MediaAsset } from '@/consumers/assets'
import { resolveSanityImagePopulatedAsset, type SanityImageAssetMapping } from '@/consumers/image'
import { resolveRenderableMediaAsset } from '@/consumers/image/resolveRenderableMediaAsset'
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

export type SanityImageProps<TAsset extends object = MediaAsset> = {
  asset: TAsset | null | undefined
  /** Maps an application-owned asset shape to the normalized media fields. */
  assetMapping?: SanityImageAssetMapping<TAsset>
  /** Shown when asset/url is missing or when the image fails to load. `null` disables fallback. */
  fallback?: ReactNode | null
  /** Alias for Next.js `priority` */
  preload?: boolean
} & ToSanityImagePropsOptions &
  Omit<NextImageProps, AssetDerivedImageProp | keyof ToSanityImagePropsOptions | 'fallback'>

export function SanityImage<TAsset extends object = MediaAsset>({
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
  const populatedAsset = resolveSanityImagePopulatedAsset(asset, assetMapping)
  const imageAsset = resolveRenderableMediaAsset(populatedAsset, cdnBaseUrl)

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
    return resolveSanityImageFallback('missing', { fallback, asset: imageAsset }) ?? null
  }

  return (
    <SanityImageClient
      derived={derived}
      asset={imageAsset}
      fallback={fallback}
      cdnBaseUrl={cdnBaseUrl}
      preload={preload}
      priority={priority}
      {...imageProps}
    />
  )
}
