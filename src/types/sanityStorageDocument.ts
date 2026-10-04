import type { SanityImageDimensions } from './asset'
import type { SanityMediaSyncFields } from './sync'

/** Persisted upstream fields under the `sanity` group (§ A). */
export type SanityUpstreamFields = {
  id?: string | null
  type?: string | null
  rev?: string | null
  assetId?: string | null
  path?: string | null
  url?: string | null
  extension?: string | null
  sha1hash?: string | null
  size?: number | null
  mimeType?: string | null
  originalFilename?: string | null
  source?: 'dataset' | 'media-library' | string | null
  media?: string | null
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
}

export type SanityMediaDocument = {
  id?: number | string | null
  name?: string | null
  alt?: string | Record<string, string | null> | null
  originalFilename?: string | null
  url?: string | null
  thumbnailURL?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  sanity?: SanityUpstreamFields | null
  sync?: SanityMediaSyncFields | null
  createdAt?: string | null
}
