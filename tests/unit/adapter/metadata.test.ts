import { describe, expect, test } from 'bun:test'

import {
  filenameFromAssetId,
  mapSanityUploadResult,
  sanityAssetIdFromDocument,
} from '../../../src/adapter/metadata.js'

describe('sanityAssetIdFromDocument', () => {
  test('returns sanity_id when present', () => {
    expect(sanityAssetIdFromDocument({ sanity_id: 'image-123-jpg' })).toBe('image-123-jpg')
    expect(sanityAssetIdFromDocument({ sanityAssetId: 'image-123-jpg' })).toBe('image-123-jpg')
  })

  test('returns null for empty or missing sanity_id', () => {
    expect(sanityAssetIdFromDocument({})).toBeNull()
    expect(sanityAssetIdFromDocument({ sanity_id: '' })).toBeNull()
    expect(sanityAssetIdFromDocument({ sanity_id: '   ' })).toBeNull()
  })
})

describe('filenameFromAssetId', () => {
  test('strips image prefix segments', () => {
    expect(filenameFromAssetId('image-abc123-800x600-png')).toBe('800x600-png')
  })

  test('returns original when too few segments', () => {
    expect(filenameFromAssetId('short')).toBe('short')
  })
})

describe('mapSanityUploadResult', () => {
  test('maps valid upload result', () => {
    const result = mapSanityUploadResult({
      _id: 'image-abc-800x600-jpg',
      _type: 'sanity.imageAsset',
      assetId: 'abc',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      path: 'images/demo/production/abc.jpg',
      sha1hash: 'abc',
      size: 1000,
      url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
    })

    expect(result._id).toBe('image-abc-800x600-jpg')
  })

  test('throws on invalid upload result', () => {
    expect(() => mapSanityUploadResult({})).toThrow()
  })
})
