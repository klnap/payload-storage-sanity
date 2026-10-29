import type { PayloadRequest } from 'payload'
import type { SanityMediaDocument } from '@/features/media/document'
import type { SanityAssetMetadata } from '@/sanity/assets'
import { getSanityAssetMetadata } from '@/sanity/assets'
import { localizedAltPopulateSelect } from '../options/localizedAltSelect'
import { mergeSanityStorageContext, SANITY_STORAGE_CONTEXT_KEY } from '../requestContext'
import { extractLqipFromMediaRow } from './extractLqip'

const METADATA_CACHE_KEY = '_sanityStoragePopulateMetadata' as const
const ALT_CACHE_KEY = '_sanityStoragePopulateAlt' as const

type EnrichSelect = {
  id: true
  alt?: true | Record<string, true>
  sanity?: {
    asset: {
      metadata: {
        dimensions: true
        lqip: true
      }
    }
  }
}

function buildEnrichSelect(args: {
  needsMetadata: boolean
  needsAlt: boolean
  altLocaleCodes: readonly string[]
}): EnrichSelect {
  const select: EnrichSelect = { id: true }
  if (args.needsAlt) {
    select.alt = localizedAltPopulateSelect(args.altLocaleCodes)
  }
  if (args.needsMetadata) {
    select.sanity = {
      asset: {
        metadata: {
          dimensions: true,
          lqip: true,
        },
      },
    }
  }
  return select
}

function localizedAltGroupIsEmpty(alt: unknown): boolean {
  if (alt == null) return true
  if (typeof alt === 'string') return alt.trim().length === 0
  if (typeof alt !== 'object' || Array.isArray(alt)) return true

  for (const value of Object.values(alt as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return false
    }
  }

  return true
}

type MetadataCache = Map<string, SanityAssetMetadata | undefined>
type AltCache = Map<string, SanityMediaDocument['alt'] | null | undefined>

function readMetadataCache(req?: PayloadRequest): MetadataCache {
  if (!req?.context || typeof req.context !== 'object') {
    return new Map()
  }

  const record = req.context as Record<string, unknown>
  const existing = record[METADATA_CACHE_KEY]
  if (existing instanceof Map) {
    return existing as MetadataCache
  }

  const cache: MetadataCache = new Map()
  record[METADATA_CACHE_KEY] = cache
  return cache
}

function readAltCache(req?: PayloadRequest): AltCache {
  if (!req?.context || typeof req.context !== 'object') {
    return new Map()
  }

  const record = req.context as Record<string, unknown>
  const existing = record[ALT_CACHE_KEY]
  if (existing instanceof Map) {
    return existing as AltCache
  }

  const cache: AltCache = new Map()
  record[ALT_CACHE_KEY] = cache
  return cache
}

function mergeSanityMetadata(
  doc: SanityMediaDocument,
  metadata: SanityAssetMetadata | undefined
): SanityMediaDocument {
  if (!metadata || Object.keys(metadata).length === 0) {
    return doc
  }

  const sanity = doc.sanity
  const asset =
    sanity?.asset != null && typeof sanity.asset === 'object' && !Array.isArray(sanity.asset)
      ? sanity.asset
      : {}

  const existingMeta =
    asset.metadata != null && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata)
      ? asset.metadata
      : {}

  return {
    ...doc,
    sanity: {
      ...sanity,
      asset: {
        ...asset,
        metadata: {
          ...existingMeta,
          ...metadata,
        },
      },
    },
  }
}

function readDraftFromRequest(req?: PayloadRequest): boolean | undefined {
  const draft = req?.query?.draft
  if (draft === 'true' || draft === true) return true
  if (draft === 'false' || draft === false) return false
  return undefined
}

/**
 * Ensures `sanity.asset.metadata` (lqip, dimensions) and localized `alt` are present before default-populate morph.
 * REST nested populate sometimes omits JSON groups even when `forceSelect` is configured.
 */
export async function enrichMediaSanityMetadataForPopulate(
  doc: SanityMediaDocument,
  args: {
    req?: PayloadRequest
    collectionSlug: string
    localizedAltGroup?: boolean
    altLocaleCodes?: readonly string[]
  }
): Promise<SanityMediaDocument> {
  const needsMetadata = !extractLqipFromMediaRow(doc)
  const needsAlt = Boolean(args.localizedAltGroup && localizedAltGroupIsEmpty(doc.alt))

  if (!needsMetadata && !needsAlt) {
    return doc
  }

  const id = doc.id
  if (id == null || id === '' || !args.req?.payload) {
    return doc
  }

  const altLocaleCodes = args.altLocaleCodes ?? []
  const cacheKey = String(id)
  const metadataCache = readMetadataCache(args.req)
  const altCache = readAltCache(args.req)

  let result = doc

  const cachedAlt = altCache.get(cacheKey)
  if (needsAlt && altCache.has(cacheKey) && !localizedAltGroupIsEmpty(cachedAlt)) {
    result = { ...result, alt: cachedAlt as SanityMediaDocument['alt'] }
  }

  if (needsMetadata && metadataCache.has(cacheKey)) {
    result = mergeSanityMetadata(result, metadataCache.get(cacheKey))
  }

  const needsMetadataFetch = needsMetadata && !metadataCache.has(cacheKey)
  const needsAltFetch = needsAlt && !altCache.has(cacheKey)

  if (!needsMetadataFetch && !needsAltFetch) {
    return result
  }

  try {
    const fresh = await args.req.payload.findByID({
      collection: args.collectionSlug,
      id,
      depth: 0,
      draft: readDraftFromRequest(args.req),
      select: buildEnrichSelect({
        needsMetadata: needsMetadataFetch,
        needsAlt: needsAltFetch,
        altLocaleCodes,
      }),
      overrideAccess: true,
      req: {
        ...args.req,
        context: {
          ...(args.req.context != null && typeof args.req.context === 'object'
            ? args.req.context
            : {}),
          [SANITY_STORAGE_CONTEXT_KEY]: mergeSanityStorageContext(args.req.context, {
            skipPopulate: true,
          }),
        },
      },
    })

    const freshDoc = fresh as SanityMediaDocument

    if (needsAltFetch) {
      altCache.set(cacheKey, freshDoc.alt ?? null)
      if (!localizedAltGroupIsEmpty(freshDoc.alt)) {
        result = { ...result, alt: freshDoc.alt }
      }
    }

    if (needsMetadataFetch) {
      let metadata = getSanityAssetMetadata(freshDoc)
      const lqip = extractLqipFromMediaRow(freshDoc)
      if (lqip && !metadata?.lqip) {
        metadata = { ...metadata, lqip }
      }
      metadataCache.set(cacheKey, metadata)
      result = mergeSanityMetadata(result, metadata)
    }
  } catch {
    if (needsAltFetch) {
      altCache.set(cacheKey, null)
    }
    if (needsMetadataFetch) {
      metadataCache.set(cacheKey, undefined)
    }
  }

  return result
}
