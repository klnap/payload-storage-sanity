import { resolveHydratedMediaUrls } from '@/features/media/cdn'
import type { SanityMediaDocument } from '@/features/media/document'
import type { DefaultPopulateAsset } from '@/features/media/populate'
import { resolveLocalizedAlt } from '@/features/media/populate'
import { getSanityAssetMetadata } from '@/sanity/assets'

export type DefaultPopulateMediaDocContext = {
  cdnBaseUrl?: string
  locale?: string | null
  fallbackLocale?: string | null
}

export function defaultPopulateMediaDoc(
  doc: SanityMediaDocument,
  ctx: DefaultPopulateMediaDocContext = {}
): DefaultPopulateAsset | null {
  const id = doc.id
  if (id == null || id === '') {
    return null
  }

  const { url } = resolveHydratedMediaUrls(doc, ctx.cdnBaseUrl)
  if (!url) {
    return null
  }

  const metadata = getSanityAssetMetadata(doc)
  const dimensions = metadata?.dimensions
  const width = dimensions?.width ?? (typeof doc.width === 'number' ? doc.width : null)
  const height = dimensions?.height ?? (typeof doc.height === 'number' ? doc.height : null)

  const aspectRatio =
    dimensions?.aspectRatio ??
    (width != null && height != null && height > 0 ? width / height : null)

  const alt = resolveLocalizedAlt(doc.alt, {
    locale: ctx.locale,
    fallbackLocale: ctx.fallbackLocale,
  })

  const result: DefaultPopulateAsset = {
    id,
    url,
    focalX: doc.focalX ?? 50,
    focalY: doc.focalY ?? 50,
    alt,
  }

  if (width != null) {
    result.width = width
  }
  if (height != null) {
    result.height = height
  }
  if (aspectRatio != null) {
    result.aspectRatio = aspectRatio
  }

  const lqip = metadata?.lqip?.trim()
  if (lqip) {
    result.lqip = lqip
  }

  return result
}
