export type ImageFit = 'max' | 'min' | 'crop' | 'clip'

export type ImageRect = { left: number; top: number; width: number; height: number }

/** Sanity image transform options, shared by the URL builder, the Next.js loader and the admin preview. */
export type ImageSize = {
  width?: number
  height?: number
  fit?: ImageFit
  quality?: number
  rect?: ImageRect
  /** Adds `auto=format` (default `true`). */
  autoFormat?: boolean
}

/** Sets Sanity image parameters on a `cdn.sanity.io` URL. Unset options leave the URL unchanged. */
export function applyImageParams(url: string, options: ImageSize): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (options.width != null) parsed.searchParams.set('w', String(options.width))
  if (options.height != null) parsed.searchParams.set('h', String(options.height))
  if (options.fit) parsed.searchParams.set('fit', options.fit)
  if (options.quality != null) parsed.searchParams.set('q', String(options.quality))
  if (options.rect) {
    const { left, top, width, height } = options.rect
    parsed.searchParams.set('rect', `${left},${top},${width},${height}`)
  }
  if (options.autoFormat !== false) parsed.searchParams.set('auto', 'format')
  return parsed.toString()
}

const IMAGE_PATH = /\.(avif|gif|jpe?g|png|tiff?|webp)$/i

/** True for URLs whose path ends in an image extension; file URLs must not receive image parameters. */
export function isImagePath(url: string): boolean {
  try {
    return IMAGE_PATH.test(new URL(url).pathname)
  } catch {
    return false
  }
}
