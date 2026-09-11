import type { SanityAssetMetadata } from '../types/asset'
import type { SanityMediaSyncFields } from '../types/sync'

export type SanityAssetIdCarrier = {
  sanity_id?: string | null
  sanityAssetId?: string | null
}

export type PayloadMediaMetadataPatch = NonNullable<SanityAssetMetadata>

/** Partial Payload media document produced by Sanity upload/sync helpers. */
export type PayloadMediaPatch = {
  sanity_id?: string | null
  _type?: string
  _rev?: string
  sanity_createdAt?: string
  sanity_updatedAt?: string
  assetId?: string
  originalFilename?: string
  path?: string
  extension?: string
  sha1hash?: string
  size?: number
  metadata?: PayloadMediaMetadataPatch
  url?: string | null
  filename?: string
  mimeType?: string
  filesize?: number
  width?: number
  height?: number
  sync?: SanityMediaSyncFields
}

export type PayloadMediaDraft = Partial<PayloadMediaPatch> &
  SanityAssetIdCarrier & {
    id?: number | null
  }
