import type { SanityAssetMediaRow, SanityPersistedAssetGroup } from '@/sanity/assets'

export type { SanityPersistedAssetGroup } from '@/sanity/assets'

/** Document `sync` group shape (mirrors `sync/mediaSync.ts` without types→sync import). */
export type SanityMediaDocumentSyncFields = {
  status?: 'available' | 'missing' | 'deleted' | 'error' | 'unknown' | null
  checkedAt?: string | null
  errorAt?: string | null
}

export type SanityMediaDocument = SanityAssetMediaRow & {
  id?: number | string | null
  name?: string | null
  alt?: string | Record<string, string | null> | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  prefix?: string | null
  sizes?: Record<string, Record<string, unknown> | null> | null
  sync?: SanityMediaDocumentSyncFields | null
  createdAt?: string | null
  sanity?: SanityPersistedAssetGroup | null
}
