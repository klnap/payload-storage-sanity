import { mediaSyncStatus } from '@/features/asset-sync/mediaSync'
import { isUnavailableSyncStatus, normalizeSyncStatus } from '@/features/asset-sync/settings/status'
import type { SanityMediaDocument } from '@/features/media/document/sanityStorageDocument'
import { getSanityAssetPath, getSanityAssetUrl } from '@/sanity/assets'
import {
  isSanityCompatibleHost,
  joinCdnOriginAndPath,
  type SanityCompatibleHostContext,
  trimTrailingSlash,
} from '@/sanity/cdn'
import { classifySanityAssetType } from './classifySanityAssetType'
import { applyImageParams, type ImageSize } from './imageParams'

const DEFAULT_CDN_ORIGIN = 'https://cdn.sanity.io'

export type ResolvePublicUrlTransform = ImageSize

export type ResolvePublicUrlContext = SanityCompatibleHostContext & {
  transform?: ResolvePublicUrlTransform
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

function rewriteOriginIfCompatible(url: string, ctx: ResolvePublicUrlContext): string {
  const custom = ctx.cdnBaseUrl?.trim()
  if (!custom || !isSanityCompatibleHost(url, ctx)) return url

  try {
    const parsed = new URL(url)
    const origin = trimTrailingSlash(custom)
    return joinCdnOriginAndPath(origin, parsed.pathname.replace(/^\//, '') + parsed.search)
  } catch {
    return url
  }
}

/** Build public CDN URL for a media document (§1b). */
export function resolvePublicUrl(
  doc: SanityMediaDocument,
  ctx: ResolvePublicUrlContext = {}
): string | null {
  const status = normalizeSyncStatus(mediaSyncStatus(doc))
  if (isUnavailableSyncStatus(status)) return null

  const path = getSanityAssetPath(doc)
  let url: string | null = null

  if (path) {
    const origin = ctx.cdnBaseUrl?.trim() ? trimTrailingSlash(ctx.cdnBaseUrl) : DEFAULT_CDN_ORIGIN
    url = joinCdnOriginAndPath(origin, path)
  } else {
    const stored = getSanityAssetUrl(doc)
    if (stored && isHttpUrl(stored)) {
      url = rewriteOriginIfCompatible(stored, ctx)
    }
  }

  if (!url) return null

  const transform = ctx.transform
  if (transform && isSanityCompatibleHost(url, ctx) && classifySanityAssetType(doc) === 'image') {
    url = applyImageParams(url, transform)
  }

  if (!isSanityCompatibleHost(url, ctx)) {
    return null
  }

  return url
}
