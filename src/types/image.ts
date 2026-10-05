import type { SanityMediaDocument } from './sanityStorageDocument'
import type { PayloadDocumentId } from '../utils/payloadDocumentId'

/** @deprecated Use `SanityMediaDocument` — kept for internal CDN helpers. */
export type SanityMediaAsset = SanityMediaDocument & {
  id: PayloadDocumentId
}

export type { SanityMediaDocument } from './sanityStorageDocument'
