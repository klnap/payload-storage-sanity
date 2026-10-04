'use client'

import type { ComponentProps } from 'react'
import { useState } from 'react'
import Image from 'next/image'

import type { DefaultPopulateAsset } from '../types/defaultPopulate'
import {
  resolveSanityImageFallback,
  type ResolveSanityImageFallbackArgs,
} from './resolveSanityImageFallback'
import type { ToSanityImagePropsResult } from './toSanityImageProps'

type NextImageProps = ComponentProps<typeof Image>

export type SanityImageClientProps = {
  derived: ToSanityImagePropsResult
  asset?: DefaultPopulateAsset | null
  fallback?: ResolveSanityImageFallbackArgs['fallback']
  renderFallback?: ResolveSanityImageFallbackArgs['renderFallback']
  preload?: boolean
} & Omit<NextImageProps, 'src' | 'alt' | 'width' | 'height' | 'fill' | 'style' | 'placeholder' | 'blurDataURL'>

export function SanityImageClient({
  derived,
  asset,
  fallback,
  renderFallback,
  preload,
  priority,
  onError,
  ...imageProps
}: SanityImageClientProps) {
  const [loadFailed, setLoadFailed] = useState(false)

  if (loadFailed) {
    const node = resolveSanityImageFallback('error', { fallback, renderFallback, asset })
    return node ?? null
  }

  return (
    <Image
      {...imageProps}
      {...derived}
      priority={priority ?? preload}
      onError={(event) => {
        setLoadFailed(true)
        onError?.(event)
      }}
    />
  )
}
