import * as v from 'valibot'

import type {
  SanityAsset,
  SanityAssetMetadata,
  SanityFileAsset,
  SanityImageAsset,
} from '../types/asset'
import type { JsonObject, JsonValue } from './json'
import { asJsonObject } from './json'

const GeopointSchema = v.object({
  _type: v.optional(v.literal('geopoint')),
  lat: v.number(),
  lng: v.number(),
  alt: v.optional(v.number()),
})

const PaletteSwatchSchema = v.object({
  background: v.string(),
  foreground: v.string(),
  population: v.number(),
  title: v.string(),
})

const DimensionsSchema = v.object({
  width: v.number(),
  height: v.number(),
  aspectRatio: v.number(),
})

const MetadataSchema = v.object({
  dimensions: v.optional(DimensionsSchema),
  lqip: v.optional(v.string()),
  blurHash: v.optional(v.string()),
  thumbHash: v.optional(v.string()),
  hasAlpha: v.optional(v.boolean()),
  isOpaque: v.optional(v.boolean()),
  location: v.optional(GeopointSchema),
  palette: v.optional(
    v.object({
      darkMuted: v.optional(PaletteSwatchSchema),
      darkVibrant: v.optional(PaletteSwatchSchema),
      dominant: v.optional(PaletteSwatchSchema),
      lightMuted: v.optional(PaletteSwatchSchema),
      lightVibrant: v.optional(PaletteSwatchSchema),
      muted: v.optional(PaletteSwatchSchema),
      vibrant: v.optional(PaletteSwatchSchema),
    })
  ),
  exif: v.optional(v.record(v.string(), v.union([v.string(), v.number(), v.boolean(), v.null()]))),
})

const SanityImageAssetSchema = v.object({
  _id: v.pipe(v.string(), v.startsWith('image-')),
  _type: v.optional(v.literal('sanity.imageAsset')),
  _createdAt: v.optional(v.string()),
  _updatedAt: v.optional(v.string()),
  _rev: v.optional(v.string()),
  assetId: v.string(),
  extension: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  originalFilename: v.optional(v.string()),
  path: v.optional(v.string()),
  sha1hash: v.optional(v.string()),
  size: v.optional(v.number()),
  url: v.pipe(v.string(), v.minLength(1)),
  metadata: v.optional(MetadataSchema),
})

const SanityFileAssetSchema = v.object({
  _id: v.pipe(v.string(), v.startsWith('file-')),
  _type: v.optional(v.literal('sanity.fileAsset')),
  _createdAt: v.optional(v.string()),
  _updatedAt: v.optional(v.string()),
  _rev: v.optional(v.string()),
  assetId: v.string(),
  extension: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  originalFilename: v.optional(v.string()),
  path: v.optional(v.string()),
  sha1hash: v.optional(v.string()),
  size: v.optional(v.number()),
  url: v.pipe(v.string(), v.minLength(1)),
})

function mapMetadata(metadata: v.InferOutput<typeof MetadataSchema>): SanityAssetMetadata {
  return {
    dimensions: metadata.dimensions,
    lqip: metadata.lqip,
    blurHash: metadata.blurHash,
    thumbHash: metadata.thumbHash,
    hasAlpha: metadata.hasAlpha,
    isOpaque: metadata.isOpaque,
    location: metadata.location
      ? {
          _type: 'geopoint',
          lat: metadata.location.lat,
          lng: metadata.location.lng,
          alt: metadata.location.alt,
        }
      : undefined,
    palette: metadata.palette,
    exif: metadata.exif,
  }
}

/** Validates a Sanity `imageAsset` or `fileAsset` document at upload/fetch boundaries. */
export function parseSanityAsset(document: JsonValue): SanityAsset | null {
  const object = asJsonObject(document)
  if (object === null) return null

  // 1. Try image asset schema
  const imageParsed = v.safeParse(SanityImageAssetSchema, object)
  if (imageParsed.success) {
    const asset = imageParsed.output
    return {
      _id: asset._id,
      _type: 'sanity.imageAsset',
      _createdAt: asset._createdAt ?? '',
      _updatedAt: asset._updatedAt ?? '',
      _rev: asset._rev ?? '',
      assetId: asset.assetId,
      extension: asset.extension ?? '',
      mimeType: asset.mimeType ?? '',
      originalFilename: asset.originalFilename,
      path: asset.path ?? '',
      sha1hash: asset.sha1hash ?? '',
      size: asset.size ?? 0,
      url: asset.url,
      metadata: asset.metadata ? mapMetadata(asset.metadata) : undefined,
    } satisfies SanityImageAsset
  }

  // 2. Try file asset schema
  const fileParsed = v.safeParse(SanityFileAssetSchema, object)
  if (fileParsed.success) {
    const asset = fileParsed.output
    return {
      _id: asset._id,
      _type: 'sanity.fileAsset',
      _createdAt: asset._createdAt ?? '',
      _updatedAt: asset._updatedAt ?? '',
      _rev: asset._rev ?? '',
      assetId: asset.assetId,
      extension: asset.extension ?? '',
      mimeType: asset.mimeType ?? '',
      originalFilename: asset.originalFilename,
      path: asset.path ?? '',
      sha1hash: asset.sha1hash ?? '',
      size: asset.size ?? 0,
      url: asset.url,
    } satisfies SanityFileAsset
  }

  return null
}

/** Validates a Sanity `imageAsset` document at upload/fetch boundaries. */
export function parseSanityImageAsset(document: JsonValue): SanityImageAsset | null {
  const asset = parseSanityAsset(document)
  return asset && asset._type === 'sanity.imageAsset' ? asset : null
}

/** Lenient entry for Sanity client `getDocument` payloads. */
export function parseSanityImageAssetDocument(document: JsonObject): SanityAsset | null {
  return parseSanityAsset(document)
}
