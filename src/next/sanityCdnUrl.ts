import { isSanityCompatibleHost } from '../utils/isSanityCompatibleHost'

export type SanityCdnUrlOptions = {
  width?: number
  height?: number
  quality?: number
  cdnBaseUrl?: string
}

export function sanityCdnUrl(src: string, opts: SanityCdnUrlOptions = {}): string {
  if (!isSanityCompatibleHost(src, { cdnBaseUrl: opts.cdnBaseUrl })) {
    return src
  }

  try {
    const url = new URL(src)
    if (opts.width != null) url.searchParams.set('w', String(opts.width))
    if (opts.height != null) url.searchParams.set('h', String(opts.height))
    if (opts.quality != null) url.searchParams.set('q', String(opts.quality))
    url.searchParams.set('auto', 'format')
    return url.toString()
  } catch {
    return src
  }
}
