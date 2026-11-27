'use client'

import Image from 'next/image'
import type { ComponentProps } from 'react'
import { useState } from 'react'

import type { MediaAsset } from '@/consumers/assets'
import { createSanityImageLoader, sanityImageLoader } from '../sanityImageLoader'
import type { ToSanityImagePropsResult } from '../toSanityImageProps'
import {
  type ResolveSanityImageFallbackArgs,
  resolveSanityImageFallback,
} from './resolveSanityImageFallback'

type NextImageProps = ComponentProps<typeof Image>

export type SanityImageClientProps = {
  derived: ToSanityImagePropsResult
  asset?: MediaAsset | null
  fallback?: ResolveSanityImageFallbackArgs['fallback']
  renderFallback?: ResolveSanityImageFallbackArgs['renderFallback']
  cdnBaseUrl?: string
  preload?: boolean
} & Omit<
  NextImageProps,
  'src' | 'alt' | 'width' | 'height' | 'fill' | 'style' | 'placeholder' | 'blurDataURL'
>

export function SanityImageClient(props: SanityImageClientProps) {
  return <SanityImageClientForSource key={props.derived.src} {...props} />
}

function SanityImageClientForSource({
  derived,
  asset,
  fallback,
  renderFallback,
  cdnBaseUrl,
  preload,
  priority,
  onError,
  ...imageProps
}: SanityImageClientProps) {
  const [loadFailed, setLoadFailed] = useState(false)
  const loader =
    imageProps.loader ?? (cdnBaseUrl ? createSanityImageLoader({ cdnBaseUrl }) : sanityImageLoader)

  if (loadFailed) {
    const node = resolveSanityImageFallback('error', { fallback, renderFallback, asset })
    return node ?? null
  }

  return (
    <Image
      {...imageProps}
      {...derived}
      loader={loader}
      priority={priority ?? preload}
      onError={(event) => {
        setLoadFailed(true)
        onError?.(event)
      }}
    />
  )
}
