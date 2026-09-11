import type { SanityClient } from '@sanity/client'
import type { SanityImageAsset } from '../types/asset'
import type { JsonValue } from '../utils/json'
import { parseSanityImageAsset } from '../utils/parseSanityImageAsset'

/** Load the canonical sanity.imageAsset document (incl. _rev, timestamps). */
export async function fetchSanityImageAsset(
  client: SanityClient,
  assetId: string
): Promise<SanityImageAsset> {
  const doc = await client.fetch<JsonValue | null>(
    `*[_id == $id && _type == "sanity.imageAsset"][0]`,
    { id: assetId }
  )

  if (doc == null) {
    throw new Error(`Sanity image asset not found: ${assetId}`)
  }

  const asset = parseSanityImageAsset(doc)
  if (!asset) {
    throw new Error(`Invalid Sanity image asset response for ${assetId}`)
  }

  return asset
}
