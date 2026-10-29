import type { JsonObject } from '@/core/contracts'
import type { SanityPersistedAssetGroup } from '@/features/media/document'
import { getSanityAssetFromMedia } from '@/sanity/assets'

export const ASSET_PRESERVE_KEYS = [
  '_id',
  '_type',
  '_rev',
  'assetId',
  'path',
  'url',
  'extension',
  'sha1hash',
  'size',
  'mimeType',
  'originalFilename',
] as const

export function isJsonRecord(value: unknown): value is JsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function mergePersistedAsset(
  incoming: JsonObject | null | undefined,
  previous: JsonObject | null | undefined
): JsonObject | undefined {
  if (!previous) {
    return incoming ?? undefined
  }
  if (!incoming) {
    return previous
  }

  const merged: JsonObject = { ...previous, ...incoming }

  for (const key of ASSET_PRESERVE_KEYS) {
    const nextVal = incoming[key]
    const prevVal = previous[key]
    if ((nextVal == null || nextVal === '') && prevVal != null && prevVal !== '') {
      merged[key] = prevVal
    }
  }

  const prevMeta = previous.metadata
  const nextMeta = incoming.metadata
  if (isJsonRecord(prevMeta) || isJsonRecord(nextMeta)) {
    merged.metadata = {
      ...(isJsonRecord(prevMeta) ? prevMeta : {}),
      ...(isJsonRecord(nextMeta) ? nextMeta : {}),
    }
  }

  return merged
}

export function mergeSanityGroupOnUpdate(
  incoming: SanityPersistedAssetGroup | null | undefined,
  previous: SanityPersistedAssetGroup | null | undefined
): SanityPersistedAssetGroup | undefined {
  const prevAsset = getSanityAssetFromMedia({ sanity: previous })
  const nextAsset = getSanityAssetFromMedia({ sanity: incoming })
  const mergedAsset = mergePersistedAsset(nextAsset, prevAsset)
  if (!mergedAsset) {
    return incoming ?? previous ?? undefined
  }
  return { asset: mergedAsset }
}
