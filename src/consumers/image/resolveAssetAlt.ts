import type { MediaAsset } from '../assets'
import { normalizeAltText } from './normalizeAltText'

export type ResolveAssetAltOptions = {
  /**
   * Contextual override for this image. `''` marks the image as decorative and is kept as-is.
   * `null` and `undefined` mean "no override".
   */
  alt?: string | null
  /** Used only when the asset has no alt text for the requested locale (`null`). */
  fallbackAlt?: string | null
}

export function resolveAssetAlt(
  asset: Pick<MediaAsset, 'alt'> | null | undefined,
  opts: ResolveAssetAltOptions = {}
): string {
  const override = normalizeAltText(opts.alt)
  if (override !== null) return override

  const fromAsset = normalizeAltText(asset?.alt)
  if (fromAsset !== null) return fromAsset

  return normalizeAltText(opts.fallbackAlt) ?? ''
}
