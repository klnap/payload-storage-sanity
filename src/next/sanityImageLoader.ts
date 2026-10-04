import { isSanityCompatibleHost } from '../utils/isSanityCompatibleHost'
import { sanityCdnUrl } from './sanityCdnUrl'

export type CreateSanityImageLoaderOptions = {
  cdnBaseUrl?: string
  cdnHosts?: string[]
}

export function createSanityImageLoader(opts: CreateSanityImageLoaderOptions = {}) {
  return ({
    src,
    width,
    quality,
  }: {
    src: string
    width: number
    quality?: number
  }): string => {
    if (!src || typeof src !== 'string') return src
    return sanityCdnUrl(src, {
      width,
      quality,
      cdnBaseUrl: opts.cdnBaseUrl,
    })
  }
}

export const sanityImageLoader = createSanityImageLoader()

export function appendSanityCdnParams(
  src: string,
  width: number,
  quality?: number,
  cdnBaseUrl?: string
): string {
  if (!isSanityCompatibleHost(src, { cdnBaseUrl })) return src
  return sanityCdnUrl(src, { width, quality, cdnBaseUrl })
}
