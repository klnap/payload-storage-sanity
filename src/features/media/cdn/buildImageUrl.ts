import type { SanityClient } from '@sanity/client'
import { createImageUrlBuilder } from '@sanity/image-url'
import * as v from 'valibot'
import type {
  SanityMediaDocument,
  SanityPersistedAssetGroup,
} from '@/features/media/document/sanityStorageDocument'
import type { SanityAssetReference } from '@/sanity/assets'
import { isSanityCompatibleHost } from '@/sanity/cdn'
import { applyImageParams, type ImageSize, isImagePath } from './imageParams'
import { isMediaAssetAvailable } from './mediaAvailability'
import { resolveImageFileRef } from './resolveAssetRef'

export type SanityImageSource =
  | string
  | SanityMediaDocument
  | SanityAssetReference
  | { url?: string | null; sanity?: SanityPersistedAssetGroup | null }
  | null
  | undefined

export type BuildSanityImageUrlOptions = ImageSize & {
  /** Needed only to build a URL from an asset reference that has no stored URL. */
  client?: SanityClient
  /** Replaces `https://cdn.sanity.io` in the returned URL. */
  cdnBaseUrl?: string
}

/**
 * The one public image URL builder. Accepts a flat populated asset, a full media document,
 * an image URL, or a Sanity asset reference. Stored URLs need no client or network request.
 * Returns `null` when the value has no image.
 */
export function buildSanityImageUrl(
  value: SanityImageSource,
  options: BuildSanityImageUrlOptions = {}
): string | null {
  const { client, cdnBaseUrl, ...size } = options
  if (value == null) return null

  if (!v.is(v.string(), value) && 'sync' in value && !isMediaAssetAvailable(value)) {
    return null
  }

  const storedUrl = !v.is(v.string(), value) && 'url' in value ? value.url?.trim() : undefined
  if (storedUrl && isSanityCompatibleHost(storedUrl)) {
    return isImagePath(storedUrl) ? applyImageParams(storedUrl, size) : storedUrl
  }

  const ref = resolveImageFileRef(value)
  if (!ref) return storedUrl || null

  if (!client) {
    throw new Error(
      'buildSanityImageUrl needs a SanityClient to build a URL from an asset reference without a stored URL.'
    )
  }

  let builder = createImageUrlBuilder(client).image(ref)
  if (size.width) builder = builder.width(size.width)
  if (size.height) builder = builder.height(size.height)
  if (size.fit) builder = builder.fit(size.fit)
  if (size.quality != null) builder = builder.quality(size.quality)
  if (size.rect) {
    const { left, top, width, height } = size.rect
    builder = builder.rect(left, top, width, height)
  }
  if (size.autoFormat !== false) builder = builder.auto('format')

  const url = builder.url()
  if (!url) return null

  if (cdnBaseUrl && cdnBaseUrl.trim().length > 0) {
    return url.replace(/https:\/\/cdn\.sanity\.io/, cdnBaseUrl.replace(/\/$/, ''))
  }

  return url
}

export function resolveAssetDocumentUrl(value: SanityImageSource): string | null {
  if (value == null) return null

  if (v.is(v.string(), value)) {
    return value.startsWith('http') ? value : null
  }

  if ('url' in value && value.url && value.url.trim().length > 0) {
    return value.url
  }

  return null
}
