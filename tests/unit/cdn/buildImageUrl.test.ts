import { describe, expect, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'

import { buildSanityImageUrl, resolveAssetDocumentUrl } from '../../../src/cdn/buildImageUrl.js'
import { buildSanityAssetUrl } from '../../../src/cdn/imageUrl.js'

function mockClient(): SanityClient {
  return {
    clientConfig: {
      projectId: 'proj123',
      dataset: 'production',
      apiVersion: '2025-01-01',
    },
  } as unknown as SanityClient
}

describe('buildSanityImageUrl', () => {
  const client = mockClient()

  test('returns null without image reference', () => {
    expect(buildSanityImageUrl({ client, value: null })).toBeNull()
    expect(buildSanityImageUrl({ client, value: {} })).toBeNull()
  })

  test('builds URL from raw Sanity image ID', () => {
    const url = buildSanityImageUrl({
      client,
      value: 'image-abc123456789abcdef123456789abcdef12345678-800x600-jpg',
      width: 400,
    })
    expect(url).toContain('https://cdn.sanity.io/images/proj123/production/')
    expect(url).toContain('w=400')
  })

  test('builds URL from populated media document with sanity_id', () => {
    const mediaDoc = {
      id: 1,
      sanity_id: 'image-abc123456789abcdef123456789abcdef12345678-800x600-jpg',
      url: 'https://cdn.sanity.io/images/proj123/production/sample.jpg',
    }

    const url = buildSanityImageUrl({ client, value: mediaDoc, width: 600 })
    expect(url).toContain('https://cdn.sanity.io/images/proj123/production/')
    expect(url).toContain('w=600')
  })

  test('returns null when populated media is marked deleted upstream', () => {
    const mediaDoc = {
      id: 1,
      sanity_id: 'image-abc123456789abcdef123456789abcdef12345678-800x600-jpg',
      url: null,
      sync: { status: 'deleted' as const },
    }

    expect(buildSanityImageUrl({ client, value: mediaDoc })).toBeNull()
  })

  test('rewrites host when cdnBaseUrl is set', () => {
    const ref = {
      _type: 'reference' as const,
      _ref: 'image-abc123456789abcdef123456789abcdef12345678-800x600-jpg',
    }

    const url = buildSanityImageUrl({
      client,
      value: ref,
      cdnBaseUrl: 'https://images.example.com',
    })
    expect(url).toContain('https://images.example.com/')
  })
})

describe('resolveAssetDocumentUrl', () => {
  test('returns populated media url', () => {
    const media = {
      id: 1,
      url: 'https://cdn.sanity.io/media/photo.jpg',
    }
    expect(resolveAssetDocumentUrl(media)).toBe('https://cdn.sanity.io/media/photo.jpg')
  })

  test('returns string URL directly', () => {
    expect(resolveAssetDocumentUrl('https://cdn.sanity.io/photo.jpg')).toBe(
      'https://cdn.sanity.io/photo.jpg'
    )
  })

  test('returns null for bare non-url string reference', () => {
    expect(resolveAssetDocumentUrl('image-a')).toBeNull()
  })
})

describe('buildSanityAssetUrl', () => {
  const config = { projectId: 'proj123', dataset: 'production' }

  test('builds canonical CDN URL for image assets', () => {
    const assetId = 'image-abc123456789abcdef123456789abcdef12345678-800x600-jpg'
    const url = buildSanityAssetUrl(assetId, config)
    expect(url).toBe(
      'https://cdn.sanity.io/images/proj123/production/image-abc123456789abcdef123456789abcdef12345678-800x600-jpg'
    )
  })

  test('builds canonical CDN URL for file assets', () => {
    const fileAssetId = 'file-abc123456789abcdef123456789abcdef12345678-pdf'
    const url = buildSanityAssetUrl(fileAssetId, config)
    expect(url).toBe(
      'https://cdn.sanity.io/files/proj123/production/file-abc123456789abcdef123456789abcdef12345678-pdf'
    )
  })
})
