/** Classification: documented contract — unknown Sanity API keys survive merge. */
import { describe, expect, test } from 'bun:test'
import type { SanityImageAsset } from '@/sanity/assets'
import { getSanityAssetId, toPersistedSanityAssetDocument } from '@/sanity/assets'
import { mediaWithSanityAsset } from '../../../helpers/sanityAssetDoc'

describe('toPersistedSanityAssetDocument', () => {
  test('merges parsed fields onto raw and preserves unknown top-level keys', () => {
    const parsed: SanityImageAsset = {
      _id: 'image-x-jpg',
      _type: 'sanity.imageAsset',
      _createdAt: '2025-01-01T00:00:00Z',
      _updatedAt: '2025-01-01T00:00:00Z',
      _rev: 'r1',
      assetId: 'x',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      path: 'images/demo/x.jpg',
      sha1hash: 'abc',
      size: 1,
      url: 'https://cdn.sanity.io/images/demo/x.jpg',
      metadata: { dimensions: { width: 10, height: 10, aspectRatio: 1 } },
    }

    const raw = {
      _id: 'image-x-jpg',
      _type: 'sanity.imageAsset',
      customVendorField: 'keep-me',
      metadata: {
        customExifBlock: { Make: 'Test' },
        dimensions: { width: 10, height: 10, aspectRatio: 1 },
      },
    }

    const merged = toPersistedSanityAssetDocument(raw, parsed)

    expect(merged.customVendorField).toBe('keep-me')
    expect(merged.metadata).toMatchObject({
      customExifBlock: { Make: 'Test' },
      dimensions: { width: 10, height: 10, aspectRatio: 1 },
    })
    expect(merged._rev).toBe('r1')
  })
})

describe('getSanityAssetId', () => {
  test('reads _id from sanity.asset', () => {
    const doc = mediaWithSanityAsset({ _id: 'image-abc-jpg', path: 'images/a.jpg' })
    expect(getSanityAssetId(doc)).toBe('image-abc-jpg')
  })
})
