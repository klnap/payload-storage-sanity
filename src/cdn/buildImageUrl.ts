import type { SanityClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'
import * as v from 'valibot'

import type { SanityAssetReference } from '../types/asset'
import type { SanityMediaAsset } from '../types/image'
import { isMediaAssetAvailable } from '../utils/mediaAvailability'
import { resolveImageFileRef } from '../utils/resolveAssetRef'

export type SanityImageSource =
  | string
  | SanityMediaAsset
  | SanityAssetReference
  | { url?: string | null; sanity_id?: string | null }
  | null
  | undefined

export type BuildSanityImageUrlArgs = {
  client: SanityClient
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

  const ref = resolveImageFileRef(value)
  if (!ref) {
    if (!v.is(v.string(), value) && 'url' in value && value.url && value.url.trim().length > 0) {
      return value.url
    }
    return null
  }

  let builder = imageUrlBuilder(client).image(ref)

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
