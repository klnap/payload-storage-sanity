import { describe, expect, test } from 'bun:test'
import { mapSanityUploadToMedia } from '@/features/media/storage-adapter'
import { toPersistedSanityAssetDocument } from '@/sanity/assets'

describe('mapSanityUploadToMedia', () => {
  test('maps Sanity asset into sanity.asset JSON', () => {
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
      path: 'images/demo/production/abc123-800x600.jpg',
      sha1hash: 'abc',
      size: 12345,
      url: 'https://cdn.sanity.io/images/demo/production/abc123-800x600.jpg',
      metadata: { dimensions: { width: 800, height: 600, aspectRatio: 1.33 } },
    }

    const result = mapSanityUploadToMedia(
      asset,
      {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
      },
      {},
      asset
    )

    expect(result).toMatchObject({
      sanity: {
        asset: {
          _id: 'image-abc-800x600-jpg',
          _type: 'sanity.imageAsset',
          path: 'images/demo/production/abc123-800x600.jpg',
          url: 'https://cdn.sanity.io/images/demo/production/abc123-800x600.jpg',
          originalFilename: 'photo.jpg',
        },
      },
    })
    expect(result).not.toHaveProperty('filename')
    expect(result).not.toHaveProperty('originalFilename')
  })

  test('merges unknown keys from raw upload JSON into sanity.asset', () => {
    const asset = {
      _id: 'image-raw-jpg',
      _type: 'sanity.imageAsset' as const,
      _createdAt: '2025-01-01T00:00:00Z',
      _updatedAt: '2025-01-01T00:00:00Z',
      _rev: 'rev1',
      assetId: 'raw',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      path: 'images/demo/raw.jpg',
      sha1hash: 'sha',
      size: 1,
      url: 'https://cdn.sanity.io/images/demo/raw.jpg',
      metadata: { dimensions: { width: 1, height: 1, aspectRatio: 1 } },
    }
    const raw = { ...asset, vendorTag: 'upstream-only' }

    const result = mapSanityUploadToMedia(
      asset,
      { filename: 'raw.jpg', mimeType: 'image/jpeg' },
      {},
      raw
    )

    const assetJson = result.sanity?.asset as Record<string, unknown> | undefined
    expect(assetJson?.vendorTag).toBe('upstream-only')
    expect(assetJson).not.toHaveProperty('focalX')
  })
})

describe('toPersistedSanityAssetDocument', () => {
  test('returns asset JSON document', () => {
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

    const persisted = toPersistedSanityAssetDocument({}, asset)

    expect(persisted._id).toBe('image-abc-jpg')
    expect(persisted.metadata).toEqual(asset.metadata)
  })
})
