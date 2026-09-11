export type SanityExifValue = string | number | boolean | null

export type SanityExif = { [key: string]: SanityExifValue }

export const SANITY_IMAGE_METADATA_EXTRACT = [
  'exif',
  'location',
  'lqip',
  'blurhash',
  'thumbhash',
  'palette',
] as const

export type SanityImageMetadataExtract = (typeof SANITY_IMAGE_METADATA_EXTRACT)[number]

export type SanityPaletteSwatch = {
  background: string
  foreground: string
  population: number
  title: string
}

export type SanityImagePalette = {
  dominant?: SanityPaletteSwatch
  vibrant?: SanityPaletteSwatch
  darkVibrant?: SanityPaletteSwatch
  lightVibrant?: SanityPaletteSwatch
  darkMuted?: SanityPaletteSwatch
  lightMuted?: SanityPaletteSwatch
  muted?: SanityPaletteSwatch
}

export type SanityImageDimensions = {
  width: number
  height: number
  aspectRatio: number
}

export type SanityGeopoint = {
  _type: 'geopoint'
  lat: number
  lng: number
  alt?: number
}

/** Mirrors `sanity.imageAsset.metadata` (dereferenced asset). */
export type SanityAssetMetadata = {
  dimensions?: SanityImageDimensions
  lqip?: string
  blurHash?: string
  thumbHash?: string
  hasAlpha?: boolean
  isOpaque?: boolean
  location?: SanityGeopoint
  palette?: SanityImagePalette
  exif?: SanityExif
}

/** Mirrors `sanity.imageAsset` (dereferenced `asset->`). */
export type SanityImageAsset = {
  _id: string
  _type: 'sanity.imageAsset'
  _createdAt: string
  _updatedAt: string
  _rev: string
  assetId: string
  extension: string
  mimeType: string
  originalFilename?: string
  path: string
  sha1hash: string
  size: number
  url: string
  metadata?: SanityAssetMetadata
}

/** Mirrors `sanity.fileAsset` (dereferenced `asset->` for non-image uploads). */
export type SanityFileAsset = {
  _id: string
  _type: 'sanity.fileAsset'
  _createdAt: string
  _updatedAt: string
  _rev: string
  assetId: string
  extension: string
  mimeType: string
  originalFilename?: string
  path: string
  sha1hash: string
  size: number
  url: string
}

/** Union of all asset documents supported by Sanity (images and generic files). */
export type SanityAsset = SanityImageAsset | SanityFileAsset

export type SanityAssetReference = {
  _type: 'reference'
  _ref: string
}
