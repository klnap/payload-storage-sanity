import type { DefaultPopulateAsset } from '../types/defaultPopulate'
import {
  resolveLocalizedAlt,
  type ResolveLocalizedAltContext,
} from '../utils/resolveLocalizedAlt'

export type ResolveAssetAltOptions = ResolveLocalizedAltContext & {
  alt?: string | null
  fallbackAlt?: string | null
}

export function resolveAssetAlt(
  asset: Pick<DefaultPopulateAsset, 'alt'> | null | undefined,
  opts: ResolveAssetAltOptions = {}
): string {
  const override = opts.alt?.trim()
  if (override) return override

  const fromAsset = resolveLocalizedAlt(asset?.alt, { locale: opts.locale })
  if (fromAsset) return fromAsset

  const fallback = opts.fallbackAlt?.trim()
  if (fallback) return fallback

  return ''
}
