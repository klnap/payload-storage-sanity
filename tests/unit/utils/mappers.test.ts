import { describe, expect, test } from 'bun:test'

import {
  mapSanityMetadataFields,
  mapSanityUploadToMedia,
  persistSanityAssetDocument,
  persistSanityMetadata,
} from '../../../src/utils/mappers.js'

describe('mapSanityMetadataFields', () => {
  test('maps only sanity.imageAsset metadata keys', () => {
    const metadata = {
      lqip: 'data:image/jpeg;base64,abc',
      blurHash: 'VKQJcdog',
      hasAlpha: true,
      isOpaque: false,
      dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
      palette: {
        dominant: { background: '#000', foreground: '#fff', population: 1, title: '#fff' },
      },
      location: { _type: 'geopoint' as const, lat: 52.1, lng: 21.0 },
      exif: { Make: 'Canon', Model: 'EOS', GPSLatitude: 52.1 },
    }

    const persisted = persistSanityMetadata(metadata)

    expect(persisted).toEqual({
      lqip: 'data:image/jpeg;base64,abc',
      blurHash: 'VKQJcdog',
      hasAlpha: true,
      isOpaque: false,
      dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
      palette: {
        dominant: { background: '#000', foreground: '#fff', population: 1, title: '#fff' },
      },
      location: { _type: 'geopoint', lat: 52.1, lng: 21.0 },
      exif: { Make: 'Canon', Model: 'EOS', GPSLatitude: 52.1 },
    })
  })

  test('returns undefined for empty input', () => {
    expect(mapSanityMetadataFields(null)).toBeUndefined()
    expect(mapSanityMetadataFields(undefined)).toBeUndefined()
  })
})

describe('mapSanityUploadToMedia', () => {
  test('maps Sanity asset to structured Payload media fields', () => {
    const asset = {
      _id: 'image-abc-800x600-jpg',
      _type: 'sanity.imageAsset' as const,
      _createdAt: '2025-01-01T00:00:00Z',
      _updatedAt: '2025-01-01T00:00:00Z',
      _rev: 'rev1',
      assetId: 'abc',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      originalFilename: 'photo.jpg',
      path: 'images/photo.jpg',
      sha1hash: 'abc',
      size: 12345,
      url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
      metadata: { dimensions: { width: 800, height: 600, aspectRatio: 1.33 } },
    }

    const result = mapSanityUploadToMedia(asset, {
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
    })

    expect(result).toMatchObject({
      sanity_id: 'image-abc-800x600-jpg',
      _type: 'sanity.imageAsset',
      _rev: 'rev1',
      sanity_createdAt: '2025-01-01T00:00:00Z',
      sanity_updatedAt: '2025-01-01T00:00:00Z',
      assetId: 'abc',
      originalFilename: 'photo.jpg',
      url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
      filename: 'image-abc-800x600-jpg',
      width: 800,
      height: 600,
      size: 12345,
      filesize: 12345,
    })
  })
})

describe('persistSanityAssetDocument', () => {
  test('persists only sanity.imageAsset keys', () => {
    const asset = {
      _id: 'image-abc-jpg',
      _type: 'sanity.imageAsset' as const,
      _createdAt: '2018-06-27T10:46:48Z',
      _updatedAt: '2018-07-30T08:07:49.238Z',
      _rev: 'rev1',
      assetId: 'abc',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      path: 'images/demo/abc.jpg',
      sha1hash: 'abc',
      size: 1000,
      url: 'https://cdn.sanity.io/images/demo/abc.jpg',
      metadata: { lqip: 'x', dimensions: { width: 1, height: 1, aspectRatio: 1 } },
    }

    const persisted = persistSanityAssetDocument(asset)

    expect(persisted).toEqual({
      _id: 'image-abc-jpg',
      _type: 'sanity.imageAsset',
      _createdAt: '2018-06-27T10:46:48Z',
      _updatedAt: '2018-07-30T08:07:49.238Z',
      _rev: 'rev1',
      assetId: 'abc',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      path: 'images/demo/abc.jpg',
      sha1hash: 'abc',
      size: 1000,
      url: 'https://cdn.sanity.io/images/demo/abc.jpg',
      metadata: { lqip: 'x', dimensions: { width: 1, height: 1, aspectRatio: 1 } },
    })
  })
})
