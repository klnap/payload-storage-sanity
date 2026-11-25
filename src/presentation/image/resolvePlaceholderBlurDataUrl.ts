import type { DefaultPopulateAsset } from '@/features/media/populate'
import { isSanityCompatibleHost } from '@/sanity/cdn'

/**
 * Tiny neutral JPEG (10×10 gray) for `next/image` blur when Sanity metadata LQIP is missing.
 * Keeps a low-quality placeholder during load without an extra network fetch.
 */
/** @internal @advanced */
export const SANITY_IMAGE_DEFAULT_BLUR_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCfAAH/2Q=='

export type ResolvePlaceholderBlurDataUrlOptions = {
  cdnBaseUrl?: string
  /** When false, returns undefined if asset has no LQIP. */
  fallback?: boolean
}

/** @internal @advanced */
export function resolvePlaceholderBlurDataUrl(
  asset: Pick<DefaultPopulateAsset, 'lqip' | 'url'> | null | undefined,
  opts: ResolvePlaceholderBlurDataUrlOptions = {}
): string | undefined {
  const fallback = opts.fallback ?? true
  const lqip = asset?.lqip?.trim()
  if (lqip) return lqip

  const url = asset?.url?.trim()
  if (!fallback || !url) return undefined

  if (isSanityCompatibleHost(url, { cdnBaseUrl: opts.cdnBaseUrl })) {
    return SANITY_IMAGE_DEFAULT_BLUR_DATA_URL
  }

  return SANITY_IMAGE_DEFAULT_BLUR_DATA_URL
}
