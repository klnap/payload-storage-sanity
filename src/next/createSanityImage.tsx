import type { ComponentType, ReactNode } from 'react'

import { SanityImage, type SanityImageProps } from './SanityImage'

export type CreateSanityImageOptions = {
  /** Default visual fallback when `asset`/`url` is missing or CDN load fails. `null` disables. */
  fallback?: ReactNode | null
}

/** Factory for app-wide default visual fallback without fragile prop spread order. */
export function createSanityImage(
  options: CreateSanityImageOptions = {}
): ComponentType<SanityImageProps> {
  const defaultFallback = options.fallback

  function SanityImageWithDefaults({ fallback, ...props }: SanityImageProps) {
    const resolvedFallback = fallback === undefined ? defaultFallback : fallback
    return <SanityImage {...props} fallback={resolvedFallback} />
  }

  SanityImageWithDefaults.displayName = 'SanityImage'

  return SanityImageWithDefaults
}
