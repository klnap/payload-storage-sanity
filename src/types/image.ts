import type { SanityMediaDocument } from './sanityStorageDocument'

/** @deprecated Use `SanityMediaDocument` — kept for internal CDN helpers. */
export type SanityMediaAsset = SanityMediaDocument & {
  id: number
}

export type { SanityMediaDocument } from './sanityStorageDocument'
