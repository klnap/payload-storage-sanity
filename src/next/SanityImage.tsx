import type { ComponentProps, ReactNode } from 'react'
import type Image from 'next/image'

import type { DefaultPopulateAsset } from '../types/defaultPopulate'
import { resolveSanityImageFallback } from './resolveSanityImageFallback'
import { SanityImageClient } from './SanityImageClient'
import { toSanityImageProps, type ToSanityImagePropsOptions } from './toSanityImageProps'

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

export type SanityImageProps = {
  asset: DefaultPopulateAsset | null | undefined
  /** Shown when asset/url is missing or when the image fails to load. `null` disables fallback. */
  fallback?: ReactNode | null
  /** Alias for Next.js `priority` */
  preload?: boolean
} & ToSanityImagePropsOptions &
  Omit<NextImageProps, AssetDerivedImageProp | keyof ToSanityImagePropsOptions | 'fallback'>

export function SanityImage({
  asset,
  fallback,
  alt,
  fallbackAlt,
  fill,
  disableFocal,
  disablePlaceholder,
  preload,
  priority,
  ...imageProps
}: SanityImageProps) {
  const derived = toSanityImageProps(asset, {
    alt,
    fallbackAlt,
    fill,
    disableFocal,
    disablePlaceholder,
  })

  if (!derived) {
    return resolveSanityImageFallback('missing', { fallback, asset }) ?? null
  }

  return (
    <SanityImageClient
      derived={derived}
      asset={asset}
      fallback={fallback}
      preload={preload}
      priority={priority}
      {...imageProps}
    />
  )
}
