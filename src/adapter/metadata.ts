import type { SanityAsset } from '../types/asset'
import type { JsonValue } from '../utils/json'
import { parseSanityAsset } from '../utils/parseSanityImageAsset'
import type { SanityAssetIdCarrier } from '../utils/payloadMedia'

export function mapSanityUploadResult(document: JsonValue): SanityAsset {
  const parsed = parseSanityAsset(document)
  if (!parsed) {
    throw new Error('Sanity upload returned an invalid asset document')
  }
  return parsed
}

export function sanityAssetIdFromDocument(doc: SanityAssetIdCarrier): string | null {
  const id = doc.sanity_id ?? doc.sanityAssetId
  return id != null && id.trim().length > 0 ? id : null
}

export function filenameFromAssetId(assetId: string): string {
  const parts = assetId.split('-')
  if (parts.length < 2) return assetId
  return parts.slice(2).join('-') || assetId
}
