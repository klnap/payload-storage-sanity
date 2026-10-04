import type { ComponentProps } from 'react'
import Image from 'next/image'

import type { DefaultPopulateAsset } from '../types/defaultPopulate'
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
  /** Alias for Next.js `priority` */
  preload?: boolean
} & ToSanityImagePropsOptions &
  Omit<NextImageProps, AssetDerivedImageProp | keyof ToSanityImagePropsOptions>

export function SanityImage({
  asset,
  locale,
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
    locale,
    alt,
    fallbackAlt,
    fill,
    disableFocal,
    disablePlaceholder,
  })

  if (!derived) return null

  return (
    <Image
      {...imageProps}
      {...derived}
      priority={priority ?? preload}
    />
  )
}
