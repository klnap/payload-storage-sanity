import type { DefaultPopulateAsset } from '../types/defaultPopulate'
import type { SanityMediaDocument } from '../types/sanityStorageDocument'
import { classifySanityAssetType } from '../utils/classifySanityAssetType'
import { resolveLocalizedAlt, type ResolveLocalizedAltContext } from '../utils/resolveLocalizedAlt'
import { resolvePublicUrl, type ResolvePublicUrlContext } from '../utils/resolvePublicUrl'

function clampFocal(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(100, Math.max(0, value))
}

export type DefaultPopulateMediaDocContext = ResolvePublicUrlContext &
  ResolveLocalizedAltContext

export function defaultPopulateMediaDoc(
  doc: SanityMediaDocument,
  ctx: DefaultPopulateMediaDocContext = {}
): DefaultPopulateAsset | Record<string, never> {
  const url = resolvePublicUrl(doc, ctx)
  if (!url || doc.id == null) {
    return {}
  }

  const assetType = classifySanityAssetType(doc)
  const dimensions = doc.sanity?.metadata?.dimensions
  const alt = resolveLocalizedAlt(doc.alt, ctx)

  const base: DefaultPopulateAsset = {
    id: doc.id,
    url,
  }

  if (assetType === 'image' && dimensions) {
    if (dimensions.width != null) base.width = dimensions.width
    if (dimensions.height != null) base.height = dimensions.height
    if (dimensions.aspectRatio != null) base.aspectRatio = dimensions.aspectRatio
  }

  if (assetType === 'image') {
    base.focalX = clampFocal(doc.focalX, 50)
    base.focalY = clampFocal(doc.focalY, 50)
    const lqip = doc.sanity?.metadata?.lqip?.trim()
    if (lqip) base.lqip = lqip
  }

  if (alt) base.alt = alt

  return base
}
