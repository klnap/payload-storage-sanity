import type { SanityClient } from '@sanity/client'

import type { SanityImageAsset } from '../types/asset'
import type { JsonValue } from '../utils/json'
import { mapSanityUploadToMedia } from '../utils/mappers'
import { parseSanityImageAsset } from '../utils/parseSanityImageAsset'
import type { SanityAssetFetchCache } from '../utils/sanityAssetCache'
import type { SanitySyncStatus } from './status'

export type FetchSanityAssetResult =
  | { status: 'available'; asset: SanityImageAsset }
  | { status: Exclude<SanitySyncStatus, 'available'>; asset?: undefined; message?: string }

type SanityHttpError = Error & {
  statusCode?: number
  response?: { statusCode?: number }
}

function isNotFoundError(error: Error): boolean {
  // SAFETY: Candidate cast inspects optional statusCode/response properties on Sanity client error
  const candidate = error as SanityHttpError
  return candidate.statusCode === 404 || candidate.response?.statusCode === 404
}

async function fetchSanityAssetSafeOnce(
  client: SanityClient,
  assetId: string
): Promise<FetchSanityAssetResult> {
  if (!assetId) {
    return { status: 'missing', message: 'Empty Sanity asset id' }
  }

  try {
    const document = await client.getDocument(assetId)

    // SAFETY: getDocument returns a JSON-serializable document or undefined
    const parsed = parseSanityImageAsset(document as JsonValue)
    if (!parsed) {
      return { status: 'missing', message: 'Sanity asset not found' }
    }

    return {
      status: 'available',
      asset: parsed,
    }
  } catch (error) {
    if (error instanceof Error && isNotFoundError(error)) {
      return { status: 'missing', message: 'Sanity asset not found' }
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch Sanity asset',
    }
  }
}

/** Fetches a Sanity image asset without throwing when upstream is missing. */
export async function fetchSanityAssetSafe(
  client: SanityClient,
  assetId: string,
  cache?: SanityAssetFetchCache
): Promise<FetchSanityAssetResult> {
  if (!cache) {
    return fetchSanityAssetSafeOnce(client, assetId)
  }

  const cached = cache.get(assetId)
  if (cached) {
    return cached
  }

  const pending = fetchSanityAssetSafeOnce(client, assetId)
  cache.set(assetId, pending)

  try {
    return await pending
  } catch (error) {
    cache.delete(assetId)
    throw error
  }
}

export function mediaPatchFromSanityAsset(
  asset: SanityImageAsset
): ReturnType<typeof mapSanityUploadToMedia> {
  return mapSanityUploadToMedia(asset, {
    filename: asset.originalFilename ?? asset._id,
    mimeType: asset.mimeType,
  })
}
