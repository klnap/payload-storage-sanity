import { applyImageParams, isImagePath } from '@/consumers/imageParams'
import { isSanityCompatibleHost, rewriteToCdnOrigin } from '@/sanity/cdn'

export type CreateSanityImageLoaderOptions = {
  /** Origin that serves Sanity assets in place of `cdn.sanity.io`, for example a proxy. */
  cdnBaseUrl?: string
}

/** A `next/image` loader: Sanity URLs move to `cdnBaseUrl` and get width and quality; other URLs pass through unchanged. */
export function createSanityImageLoader(opts: CreateSanityImageLoaderOptions = {}) {
  const ctx = { cdnBaseUrl: opts.cdnBaseUrl }
  return ({ src, width, quality }: { src: string; width: number; quality?: number }): string => {
    if (!src || typeof src !== 'string') return src
    const url = rewriteToCdnOrigin(src, ctx)
    if (!isSanityCompatibleHost(url, ctx) || !isImagePath(url)) return url
    return applyImageParams(url, { width, quality })
  }
}

export const sanityImageLoader = createSanityImageLoader()
