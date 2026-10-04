import type { ReactNode } from 'react'

import type { DefaultPopulateAsset } from '../types/defaultPopulate'

export type SanityImageFallbackReason = 'missing' | 'error'

export type SanityImageFallbackProps = {
  reason: SanityImageFallbackReason
  asset?: DefaultPopulateAsset | null
}

export type ResolveSanityImageFallbackArgs = {
  fallback?: ReactNode | null
  renderFallback?: (props: SanityImageFallbackProps) => ReactNode
  asset?: DefaultPopulateAsset | null
}

/** `fallback={null}` disables fallback; `undefined` means no fallback UI. */
export function resolveSanityImageFallback(
  reason: SanityImageFallbackReason,
  args: ResolveSanityImageFallbackArgs
): ReactNode | null {
  if (args.fallback === null) {
    return null
  }

  if (args.renderFallback) {
    return args.renderFallback({ reason, asset: args.asset })
  }

  if (args.fallback !== undefined) {
    return args.fallback
  }

  return null
}

export function shouldUseSanityImageFallback(
  hasDerivedImage: boolean,
  loadFailed: boolean,
  fallback: ReactNode | null | undefined,
  renderFallback?: (props: SanityImageFallbackProps) => ReactNode
): boolean {
  if (fallback === null && !renderFallback) {
    return false
  }
  if (fallback === undefined && !renderFallback) {
    return false
  }
  return !hasDerivedImage || loadFailed
}
