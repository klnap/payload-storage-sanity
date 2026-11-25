import type { JsonObject, PayloadDocumentId } from '@/core/contracts'
import type {
  SanityMediaDocumentSyncFields,
  SanityPersistedAssetGroup,
} from '@/features/media/document'

export type SanityAssetIdCarrier = {
  sanity?: SanityPersistedAssetGroup | null
}

export type PayloadMediaPatch = {
  sanity?: SanityPersistedAssetGroup | null
  filename?: string
  sync?: SanityMediaDocumentSyncFields
}

export type PayloadMediaDraft = Partial<PayloadMediaPatch> &
  SanityAssetIdCarrier & {
    id?: PayloadDocumentId | null
  }

export type PayloadMediaMetadataPatch = JsonObject
