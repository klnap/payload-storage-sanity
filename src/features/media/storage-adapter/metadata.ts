import type { JsonValue } from '@/core/contracts'
import type { SanityAssetIdCarrier } from '@/features/media/document/payloadMedia'
import type { SanityAsset } from '@/sanity/assets'
import { getSanityAssetId } from '@/sanity/assets'
import { parseSanityAsset } from '@/sanity/client'

export function mapSanityUploadResult(document: JsonValue): SanityAsset {
  const parsed = parseSanityAsset(document)
  if (!parsed) {
    throw new Error('Sanity upload returned an invalid asset document')
  }
  return parsed
}

export function sanityAssetIdFromDocument(doc: SanityAssetIdCarrier): string | null {
  return getSanityAssetId({ sanity: doc.sanity })
}
