import type { SanityImageDimensions } from './asset'
import type { SanityMediaSyncFields } from './sync'

/** Payload media row — mirrors sanity.imageAsset / sanity.fileAsset (+ Payload upload + sync fields). */
export type SanityMediaAsset = {
  id: number
  /** sanity asset `_id` (`image-...` or `file-...`). Avoids Payload reserved `_id`. */
  sanity_id?: string | null
  _type?: 'sanity.imageAsset' | 'sanity.fileAsset' | string
  _rev?: string | null
  sanity_createdAt?: string | null
  sanity_updatedAt?: string | null
  assetId?: string | null
  originalFilename?: string | null
  path?: string | null
  extension?: string | null
  sha1hash?: string | null
  size?: number | null
  metadata?: {
    dimensions?: SanityImageDimensions | null
    lqip?: string | null
    blurHash?: string | null
    thumbHash?: string | null
    hasAlpha?: boolean | null
    isOpaque?: boolean | null
    location?: {
      _type: 'geopoint'
      lat: number
      lng: number
      alt?: number | null
    } | null
    palette?: Record<
      string,
      { background: string; foreground: string; population: number; title: string }
    > | null
    exif?: Record<string, string | number | boolean | null> | null
  } | null
  url?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  sync?: SanityMediaSyncFields | null
}
