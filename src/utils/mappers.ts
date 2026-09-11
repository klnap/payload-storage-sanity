import type {
  SanityAsset,
  SanityAssetMetadata,
  SanityGeopoint,
  SanityImageAsset,
  SanityImagePalette,
  SanityPaletteSwatch,
} from '../types/asset'
import type {
  PayloadMediaDraft,
  PayloadMediaMetadataPatch,
  PayloadMediaPatch,
} from './payloadMedia'
import { slugifyFilename } from './slugify'

function mapSwatch(swatch?: SanityPaletteSwatch) {
  if (!swatch) return undefined

  return {
    background: swatch.background,
    foreground: swatch.foreground,
    population: swatch.population,
    title: swatch.title,
  }
}

function mapPalette(palette?: SanityImagePalette) {
  if (!palette) return undefined

  const entries: [string, ReturnType<typeof mapSwatch>][] = [
    ['darkMuted', mapSwatch(palette.darkMuted)],
    ['darkVibrant', mapSwatch(palette.darkVibrant)],
    ['dominant', mapSwatch(palette.dominant)],
    ['lightMuted', mapSwatch(palette.lightMuted)],
    ['lightVibrant', mapSwatch(palette.lightVibrant)],
    ['muted', mapSwatch(palette.muted)],
    ['vibrant', mapSwatch(palette.vibrant)],
  ].filter((entry): entry is [string, NonNullable<ReturnType<typeof mapSwatch>>] => {
    return entry[1] !== undefined
  })

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function mapExif(exif?: SanityAssetMetadata['exif']) {
  if (exif == null) return undefined

  const entries = Object.entries(exif).filter(
    ([key, value]) => key !== '_type' && value !== undefined && value !== null
  )

  if (entries.length === 0) return undefined

  return Object.fromEntries(entries)
}

function mapLocation(location?: SanityAssetMetadata['location']): SanityGeopoint | undefined {
  if (location == null) return undefined

  const { lat, lng, alt } = location
  const geopoint: SanityGeopoint = {
    _type: 'geopoint',
    lat,
    lng,
  }
  if (alt !== undefined) {
    geopoint.alt = alt
  }
  return geopoint
}

/** Maps sanity.imageAsset `metadata` to the Payload `metadata` group. */
export function mapSanityMetadataFields(
  metadata?: SanityAssetMetadata | null
): PayloadMediaMetadataPatch | undefined {
  if (metadata == null) return undefined

  const dimensions = metadata.dimensions
    ? {
        width: metadata.dimensions.width,
        height: metadata.dimensions.height,
        aspectRatio: metadata.dimensions.aspectRatio,
      }
    : undefined

  const mapped = {
    dimensions,
    lqip: metadata.lqip,
    blurHash: metadata.blurHash,
    thumbHash: metadata.thumbHash,
    hasAlpha: metadata.hasAlpha,
    isOpaque: metadata.isOpaque,
    location: mapLocation(metadata.location),
    palette: mapPalette(metadata.palette),
    exif: mapExif(metadata.exif),
  } satisfies PayloadMediaMetadataPatch

  const filtered = Object.fromEntries(
    Object.entries(mapped).filter(([, value]) => value !== undefined && value !== null)
  )
  // SAFETY: filtered entries originate from mapped conforming to PayloadMediaMetadataPatch
  const patch = filtered as PayloadMediaMetadataPatch

  return Object.keys(patch).length > 0 ? patch : undefined
}

export type UploadFileMeta = {
  filename: string
  mimeType: string
}

export function mapSanityUploadToMedia(
  asset: SanityAsset,
  _file: UploadFileMeta,
  data: PayloadMediaDraft = {}
): PayloadMediaPatch {
  const metadata =
    'metadata' in asset && asset.metadata ? mapSanityMetadataFields(asset.metadata) : undefined
  const dimensions = 'metadata' in asset ? asset.metadata?.dimensions : undefined

  return {
    ...data,
    sanity_id: asset._id,
    _type: asset._type,
    _rev: asset._rev,
    sanity_createdAt: asset._createdAt,
    sanity_updatedAt: asset._updatedAt,
    assetId: asset.assetId,
    originalFilename: asset.originalFilename
      ? slugifyFilename(asset.originalFilename)
      : asset.originalFilename,
    path: asset.path,
    extension: asset.extension,
    sha1hash: asset.sha1hash,
    size: asset.size,
    metadata,
    url: asset.url,
    filename: asset._id,
    mimeType: asset.mimeType,
    filesize: asset.size,
    width: dimensions?.width,
    height: dimensions?.height,
  } satisfies PayloadMediaPatch
}

export function persistSanityMetadata(
  metadata?: SanityAssetMetadata | null
): PayloadMediaMetadataPatch | undefined {
  return mapSanityMetadataFields(metadata)
}

export type PersistedSanityAssetDocument = {
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
  metadata?: PayloadMediaMetadataPatch
}

/** Store the full Sanity `imageAsset` document returned from upload. */
export function persistSanityAssetDocument(asset: SanityImageAsset): PersistedSanityAssetDocument {
  const stored: PersistedSanityAssetDocument = {
    _id: asset._id,
    _type: asset._type,
    _createdAt: asset._createdAt,
    _updatedAt: asset._updatedAt,
    _rev: asset._rev,
    assetId: asset.assetId,
    extension: asset.extension,
    mimeType: asset.mimeType,
    path: asset.path,
    sha1hash: asset.sha1hash,
    size: asset.size,
    url: asset.url,
    metadata: persistSanityMetadata(asset.metadata) ?? asset.metadata,
  }

  if (asset.originalFilename != null) {
    stored.originalFilename = asset.originalFilename
  }

  return stored
}
