import { applyImageParams } from '@/features/media/cdn'
import { isSanityCompatibleHost } from '@/sanity/cdn'

export type CreateSanityImageLoaderOptions = {
  /** Custom Sanity CDN host, for example a proxy in front of `cdn.sanity.io`. */
  cdnBaseUrl?: string
}

/** A `next/image` loader: Sanity URLs get width and quality; other URLs pass through unchanged. */
export function createSanityImageLoader(opts: CreateSanityImageLoaderOptions = {}) {
  return ({ src, width, quality }: { src: string; width: number; quality?: number }): string => {
    if (!src || typeof src !== 'string') return src
    if (!isSanityCompatibleHost(src, { cdnBaseUrl: opts.cdnBaseUrl })) return src
    return applyImageParams(src, { width, quality })
  }
}

export const sanityImageLoader = createSanityImageLoader()
