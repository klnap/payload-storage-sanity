import type { JsonObject } from '@/core/contracts'
import type { SanityAsset, SanityAssetMetadata } from '@/sanity/assets'
import type { SanityAssetMediaRow, SanityPersistedAssetGroup } from './mediaRow'

export type PersistedSanityAsset = JsonObject

function assetGroup(doc: SanityAssetMediaRow | null | undefined): SanityPersistedAssetGroup | null {
  const sanity = doc?.sanity
  if (sanity == null || typeof sanity !== 'object') {
    return null
  }
  return sanity
}

export function getSanityAssetFromMedia(
  doc: SanityAssetMediaRow | null | undefined
): PersistedSanityAsset | null {
  const asset = assetGroup(doc)?.asset
  if (asset == null || typeof asset !== 'object' || Array.isArray(asset)) {
    return null
  }
  return asset as PersistedSanityAsset
}

export function getSanityAssetId(doc: SanityAssetMediaRow | null | undefined): string | null {
  const id = getSanityAssetFromMedia(doc)?._id
  if (typeof id !== 'string' || id.trim().length === 0) {
    return null
  }
  return id
}

export function getSanityAssetPath(doc: SanityAssetMediaRow | null | undefined): string | null {
  const path = getSanityAssetFromMedia(doc)?.path
  if (typeof path !== 'string' || path.trim().length === 0) {
    return null
  }
  return path
}

export function getSanityAssetUrl(doc: SanityAssetMediaRow | null | undefined): string | null {
  const url = getSanityAssetFromMedia(doc)?.url
  if (typeof url !== 'string' || url.trim().length === 0) {
    return null
  }
  return url
}

export function getSanityAssetSha1(doc: SanityAssetMediaRow | null | undefined): string | null {
  const sha1 = getSanityAssetFromMedia(doc)?.sha1hash
  if (typeof sha1 !== 'string' || sha1.trim().length === 0) {
    return null
  }
  return sha1
}

function readAssetMetadata(asset: PersistedSanityAsset | null): SanityAssetMetadata | undefined {
  const metadata = asset?.metadata
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined
  }
  return metadata as SanityAssetMetadata
}

export function getSanityAssetMetadata(
  doc: SanityAssetMediaRow | null | undefined
): SanityAssetMetadata | undefined {
  return readAssetMetadata(getSanityAssetFromMedia(doc))
}

export function sanityAssetDocumentFromParsed(asset: SanityAsset): JsonObject {
  const base: JsonObject = {
    _id: asset._id,
    _type: asset._type,
    _createdAt: asset._createdAt,
    _updatedAt: asset._updatedAt,
    _rev: asset._rev,
    assetId: asset.assetId,
    extension: asset.extension,
    mimeType: asset.mimeType,
    path: asset.path,
    sha1hash: asset.sha1hash,
    size: asset.size,
    url: asset.url,
  }

  if (asset.originalFilename != null) {
    base.originalFilename = asset.originalFilename
  }

  if ('metadata' in asset && asset.metadata != null) {
    base.metadata = asset.metadata as JsonObject
  }

  return base
}

function isJsonObject(value: unknown): value is JsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/** Merge validated asset fields onto raw API JSON; preserve unknown keys from `raw`. */
export function toPersistedSanityAssetDocument(
  raw: JsonObject,
  parsed: SanityAsset
): PersistedSanityAsset {
  const fromParsed = sanityAssetDocumentFromParsed(parsed)
  const merged: JsonObject = { ...raw, ...fromParsed }

  const rawMeta = raw.metadata
  const parsedMeta = fromParsed.metadata
  if (isJsonObject(rawMeta) || isJsonObject(parsedMeta)) {
    merged.metadata = {
      ...(isJsonObject(rawMeta) ? rawMeta : {}),
      ...(isJsonObject(parsedMeta) ? parsedMeta : {}),
    }
  }

  return merged
}

export function parsePersistedSanityAsset(value: unknown): PersistedSanityAsset | null {
  if (!isJsonObject(value)) {
    return null
  }
  const id = value._id
  if (typeof id !== 'string' || id.trim().length === 0) {
    return null
  }
  return value
}
