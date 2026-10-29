'use client'

import type Image from 'next/image'
import type { ComponentProps, ReactNode } from 'react'

import type { DefaultPopulateAsset } from '@/features/media/populate'
import { type ToSanityImagePropsOptions, toSanityImageProps } from '../toSanityImageProps'
import {
  resolveSanityImageFallback,
  type SanityImageFallbackProps,
} from './resolveSanityImageFallback'
import { SanityImageClient } from './SanityImageClient'

type NextImageProps = ComponentProps<typeof Image>

type AssetDerivedImageProp =
  | 'src'
  | 'alt'
  | 'width'
  | 'height'
  | 'fill'
  | 'style'
  | 'placeholder'
  | 'blurDataURL'

/** Client-only `SanityImage` with optional `renderFallback` (e.g. different UI per reason). */
export type SanityImageInteractiveProps = {
  asset: DefaultPopulateAsset | null | undefined
  fallback?: ReactNode | null
  renderFallback?: (props: SanityImageFallbackProps) => ReactNode
  preload?: boolean
} & ToSanityImagePropsOptions &
  Omit<NextImageProps, AssetDerivedImageProp | keyof ToSanityImagePropsOptions | 'fallback'>

export function SanityImageInteractive({
  asset,
  fallback,
  renderFallback,
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
}: SanityImageInteractiveProps) {
  const derived = toSanityImageProps(asset, {
    alt,
    fallbackAlt,
    fill,
    disableFocal,
    disablePlaceholder,
    placeholderFallback,
    cdnBaseUrl,
  })

  if (!derived) {
    return resolveSanityImageFallback('missing', { fallback, renderFallback, asset }) ?? null
  }

  return (
    <SanityImageClient
      derived={derived}
      asset={asset}
      fallback={fallback}
      renderFallback={renderFallback}
      preload={preload}
      priority={priority}
      {...imageProps}
    />
  )
}
