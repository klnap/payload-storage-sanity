import type { JsonObject } from '@/core/contracts'

/** Hidden `sanity` group — upstream Sanity asset document in `asset` JSON. */
export type SanityPersistedAssetGroup = {
  asset?: JsonObject | null
}

/** Minimal persisted media row shape for reading nested `sanity.asset`. */
export type SanityAssetMediaRow = {
  sanity?: SanityPersistedAssetGroup | null
  url?: string | null
  thumbnailURL?: string | null
  sync?: { status?: string | null } | null
}
