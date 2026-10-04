import type {
  SanityAsset,
  SanityAssetMetadata,
  SanityGeopoint,
  SanityImageAsset,
  SanityImagePalette,
  SanityPaletteSwatch,
} from '../types/asset'
import type { SanityUpstreamFields } from '../types/sanityStorageDocument'
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

  const palette = mapPalette(metadata.palette) as PayloadMediaMetadataPatch['palette']
  const exif = mapExif(metadata.exif) as PayloadMediaMetadataPatch['exif']

  const mapped: PayloadMediaMetadataPatch = {
    dimensions,
    lqip: metadata.lqip,
    blurHash: metadata.blurHash,
    thumbHash: metadata.thumbHash,
    hasAlpha: metadata.hasAlpha,
    isOpaque: metadata.isOpaque,
    location: mapLocation(metadata.location),
    ...(palette ? { palette } : {}),
    ...(exif ? { exif } : {}),
  }

  const filtered = Object.fromEntries(
    Object.entries(mapped).filter(([, value]) => value !== undefined && value !== null)
  )
  const patch = filtered as PayloadMediaMetadataPatch

  return Object.keys(patch).length > 0 ? patch : undefined
}

export type UploadFileMeta = {
  filename: string
  mimeType: string
}

function mapAssetToSanityGroup(asset: SanityAsset): SanityUpstreamFields {
  const metadata =
    'metadata' in asset && asset.metadata ? mapSanityMetadataFields(asset.metadata) : undefined

  return {
    id: asset._id,
    type: asset._type,
    rev: asset._rev,
    assetId: asset.assetId,
    path: asset.path,
    url: asset.url,
    extension: asset.extension,
    sha1hash: asset.sha1hash,
    size: asset.size,
    mimeType: asset.mimeType,
    originalFilename: asset.originalFilename
      ? slugifyFilename(asset.originalFilename)
      : asset.originalFilename,
    metadata,
    source: 'dataset',
  }
}

export function mapSanityUploadToMedia(
  asset: SanityAsset,
  _file: UploadFileMeta,
  data: PayloadMediaDraft = {}
): PayloadMediaPatch {
  const originalFilename = asset.originalFilename
    ? slugifyFilename(asset.originalFilename)
    : asset.originalFilename

  return {
    ...data,
    sanity: mapAssetToSanityGroup(asset),
    originalFilename,
    filename: asset._id,
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
