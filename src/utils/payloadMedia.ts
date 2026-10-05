import type { SanityUpstreamFields } from '../types/sanityStorageDocument'
import type { SanityMediaSyncFields } from '../types/sync'
import type { PayloadDocumentId } from './payloadDocumentId'

export type SanityAssetIdCarrier = {
  sanity?: SanityUpstreamFields | null
  sanityAssetId?: string | null
}

export type PayloadMediaMetadataPatch = NonNullable<SanityUpstreamFields['metadata']>

export type PayloadMediaPatch = {
  sanity?: SanityUpstreamFields | null
  originalFilename?: string
  filename?: string
  sync?: SanityMediaSyncFields
}

export type PayloadMediaDraft = Partial<PayloadMediaPatch> &
  SanityAssetIdCarrier & {
    id?: PayloadDocumentId | null
  }
