import type { SanityClient } from '@sanity/client'
import { createImageUrlBuilder } from '@sanity/image-url'
import * as v from 'valibot'
import type { SanityAssetReference } from '@/sanity/assets/asset'
import { isSanityCompatibleHost } from '@/sanity/cdn/availability/isSanityCompatibleHost'
import type { MediaAsset } from './assets'
import { applyImageParams, type ImageSize, isImagePath } from './imageParams'

type SanityMediaConsumerSource = {
  id?: number | string | null
  url?: string | null
  sanity?: {
    asset?: {
      _id?: string | null
      path?: string | null
      url?: string | null
    } | null
  } | null
  sync?: { status?: string | null } | null
}

export type SanityImageSource =
  | string
  | MediaAsset
  | SanityAssetReference
  | SanityMediaConsumerSource
  | null
  | undefined

export type BuildSanityImageUrlOptions = ImageSize & {
  /** Needed only to build a URL from an asset reference that has no stored URL. */
  client?: SanityClient
  /** Replaces `https://cdn.sanity.io` in the returned URL. */
  cdnBaseUrl?: string
}

function getAssetReference(value: SanityImageSource): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (value == null) return null

  if ('_ref' in value && typeof value._ref === 'string' && value._ref.trim()) {
    return value._ref.trim()
  }

  const asset = 'sanity' in value ? value.sanity?.asset : undefined
  return typeof asset?._id === 'string' && asset._id.trim() ? asset._id.trim() : null
}

function isUnavailable(value: SanityMediaConsumerSource): boolean {
  if (value.sync == null) return false
  const status = value.sync.status
  if (status === 'missing' || status === 'deleted' || status === 'error') return true
  const asset = value.sanity?.asset
  return !(
    (typeof asset?.path === 'string' && asset.path.trim()) ||
    (typeof asset?.url === 'string' && asset.url.trim()) ||
    (typeof value.url === 'string' && value.url.trim())
  )
}

/** Builds a Sanity CDN URL from consumer-side media shapes without Payload runtime imports. */
export function buildSanityImageUrl(
  value: SanityImageSource,
  options: BuildSanityImageUrlOptions = {}
): string | null {
  const { client, cdnBaseUrl, ...size } = options
  if (value == null) return null

  if (!v.is(v.string(), value) && 'sync' in value && isUnavailable(value)) return null

  const storedUrl = !v.is(v.string(), value) && 'url' in value ? value.url?.trim() : undefined
  if (storedUrl && isSanityCompatibleHost(storedUrl)) {
    return isImagePath(storedUrl) ? applyImageParams(storedUrl, size) : storedUrl
  }

  const ref = getAssetReference(value)
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
