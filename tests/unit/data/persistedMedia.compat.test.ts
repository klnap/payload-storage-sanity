/** Representative persisted media documents for the documented storage contract. */
import { describe, expect, test } from 'bun:test'
import { readMediaSync } from '@/features/asset-sync'
import { resolvePublicUrl } from '@/features/media/cdn'
import type { SanityMediaDocument } from '@/features/media/document'
import { getSanityAssetFromMedia, getSanityAssetId } from '@/sanity/assets'

const baselinePersistedMedia: SanityMediaDocument = {
  id: 10,
  url: 'https://cdn.sanity.io/images/demo/production/photo-abc.jpg',
  width: 1600,
  height: 900,
  alt: 'Hero',
  sanity: {
    asset: {
      _id: 'image-abc',
      _type: 'sanity.imageAsset',
      path: 'images/demo/production/photo-abc.jpg',
      url: 'https://cdn.sanity.io/images/demo/production/photo-abc.jpg',
      originalFilename: 'photo-abc.jpg',
      sha1hash: 'deadbeef',
      metadata: {
        dimensions: { width: 1600, height: 900, aspectRatio: 1600 / 900 },
        lqip: 'data:image/jpeg;base64,/9j/4AAQ',
      },
      vendorExtension: 'preserved',
    },
  },
  focalX: 40,
  focalY: 60,
  sync: {
    status: 'available',
    checkedAt: '2026-01-01T00:00:00.000Z',
  },
}

describe('persisted media baseline', () => {
  test('resolvePublicUrl reads sanity.asset.url + sync status', () => {
    const url = resolvePublicUrl(baselinePersistedMedia)
    expect(url).toBe(baselinePersistedMedia.sanity?.asset?.url as string)
  })

  test('readMediaSync returns persisted sync group', () => {
    expect(readMediaSync(baselinePersistedMedia).status).toBe('available')
  })

  test('accessors use exact Sanity field names inside sanity.asset', () => {
    expect(getSanityAssetId(baselinePersistedMedia)).toBe('image-abc')
    const asset = getSanityAssetFromMedia(baselinePersistedMedia)
    expect(asset?.originalFilename).toBe('photo-abc.jpg')
    expect(asset?.sha1hash).toBe('deadbeef')
    expect(asset?.vendorExtension).toBe('preserved')
  })

  test('focal point remains Payload-owned on document root', () => {
    expect(baselinePersistedMedia.focalX).toBe(40)
    expect(getSanityAssetFromMedia(baselinePersistedMedia)).not.toHaveProperty('focalX')
  })
})
