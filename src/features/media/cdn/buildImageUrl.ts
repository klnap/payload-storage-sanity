import type { SanityClient } from '@sanity/client'
import { createImageUrlBuilder } from '@sanity/image-url'
import * as v from 'valibot'
import type {
  SanityMediaDocument,
  SanityPersistedAssetGroup,
} from '@/features/media/document/sanityStorageDocument'
import type { SanityAssetReference } from '@/sanity/assets'
import { isSanityCompatibleHost } from '@/sanity/cdn'
import { isMediaAssetAvailable } from './mediaAvailability'
import { resolveImageFileRef } from './resolveAssetRef'
import { appendTransformParams } from './resolvePublicUrl'

const IMAGE_PATH = /\.(avif|gif|jpe?g|png|tiff?|webp)$/i

export type SanityImageSource =
  | string
  | SanityMediaDocument
  | SanityAssetReference
  | { url?: string | null; sanity?: SanityPersistedAssetGroup | null }
  | null
  | undefined

export type BuildSanityImageUrlArgs = {
  /** Needed only to build a URL from an asset reference without a stored `url`. */
  client?: SanityClient
  value: SanityImageSource
  width?: number
  height?: number
  cdnBaseUrl?: string
}

export function buildSanityImageUrl({
  client,
  value,
  width,
  height,
  cdnBaseUrl,
}: BuildSanityImageUrlArgs): string | null {
  if (value == null) return null

  if (!v.is(v.string(), value)) {
    if ('sync' in value && !isMediaAssetAvailable(value)) {
      return null
    }
  }

  const storedUrl = !v.is(v.string(), value) && 'url' in value ? value.url?.trim() : undefined
  if (storedUrl && isSanityCompatibleHost(storedUrl)) {
    return withImageParams(storedUrl, { width, height })
  }

  const ref = resolveImageFileRef(value)
  if (!ref) {
    if (storedUrl) return storedUrl
    return null
  }

  if (!client) {
    throw new Error(
      'buildSanityImageUrl needs a SanityClient to build a URL from an asset reference without a stored URL.'
    )
  }

  let builder = createImageUrlBuilder(client).image(ref)

  if (width) builder = builder.width(width)
  if (height) builder = builder.height(height)

  const url = builder.auto('format').url()
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

/** Applies width and height to Sanity image URLs only; file URLs stay unchanged. */
function withImageParams(url: string, size: { width?: number; height?: number }): string {
  const path = new URL(url).pathname
  if (!IMAGE_PATH.test(path)) return url
  return appendTransformParams(url, size)
}
