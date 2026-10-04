import type { SanityMediaDocument } from '../types/sanityStorageDocument'
import { classifySanityAssetType } from './classifySanityAssetType'
import { isSanityCompatibleHost, type SanityCompatibleHostContext } from './isSanityCompatibleHost'
import { joinCdnOriginAndPath, trimTrailingSlash } from './joinCdnOriginAndPath'
import { isUnavailableSyncStatus, normalizeSyncStatus } from '../sync/status'
import { mediaSyncStatus } from './mediaSync'

const DEFAULT_CDN_ORIGIN = 'https://cdn.sanity.io'

export type ResolvePublicUrlTransform = {
  width?: number
  height?: number
  fit?: 'max' | 'min' | 'crop' | 'clip'
  autoFormat?: boolean
}

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

function appendTransformParams(url: string, transform: ResolvePublicUrlTransform): string {
  try {
    const parsed = new URL(url)
    if (transform.width != null) parsed.searchParams.set('w', String(transform.width))
    if (transform.height != null) parsed.searchParams.set('h', String(transform.height))
    if (transform.fit) parsed.searchParams.set('fit', transform.fit)
    if (transform.autoFormat !== false) parsed.searchParams.set('auto', 'format')
    return parsed.toString()
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

  const source = doc.sanity?.source ?? 'dataset'

  if (source !== 'dataset') {
    const mlUrl = doc.sanity?.url?.trim()
    return mlUrl && isHttpUrl(mlUrl) ? mlUrl : null
  }

  const path = doc.sanity?.path?.trim()
  let url: string | null = null

  if (path) {
    const origin = ctx.cdnBaseUrl?.trim()
      ? trimTrailingSlash(ctx.cdnBaseUrl)
      : DEFAULT_CDN_ORIGIN
    url = joinCdnOriginAndPath(origin, path)
  } else {
    const stored = doc.sanity?.url?.trim()
    if (stored && isHttpUrl(stored)) {
      url = rewriteOriginIfCompatible(stored, ctx)
    }
  }

  if (!url) return null

  const transform = ctx.transform
  if (
    transform &&
    isSanityCompatibleHost(url, ctx) &&
    classifySanityAssetType(doc) === 'image'
  ) {
    url = appendTransformParams(url, transform)
  }

  return url
}
