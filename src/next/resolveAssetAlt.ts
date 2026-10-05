import type { DefaultPopulateAsset } from '../types/defaultPopulate'

export type ResolveAssetAltOptions = {
  alt?: string | null
  fallbackAlt?: string | null
}

function pickAltString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveAssetAlt(
  asset: Pick<DefaultPopulateAsset, 'alt'> | null | undefined,
  opts: ResolveAssetAltOptions = {}
): string {
  const override = pickAltString(opts.alt)
  if (override) return override

  const fromAsset = pickAltString(asset?.alt)
  if (fromAsset) return fromAsset

  const fallback = pickAltString(opts.fallbackAlt)
  if (fallback) return fallback

  return ''
}
