import { describe, expect, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'

import { buildSanityImageUrl, resolveAssetDocumentUrl } from '@/features/media/cdn'

function mockClient(): SanityClient {
  return {
    clientConfig: {
      projectId: 'proj123',
      dataset: 'production',
      apiVersion: '2026-01-01',
    },
  } as unknown as SanityClient
}

const REF = 'image-abc123456789abcdef123456789abcdef12345678-800x600-jpg'
const STORED = 'https://cdn.sanity.io/images/proj123/production/sample.jpg'

describe('buildSanityImageUrl', () => {
  const client = mockClient()

  test('returns null without image reference', () => {
    expect(buildSanityImageUrl(null, { client })).toBeNull()
    expect(buildSanityImageUrl({}, { client })).toBeNull()
  })

  test('builds URL from raw Sanity image ID', () => {
    const url = buildSanityImageUrl(REF, { client, width: 400 })
    expect(url).toContain('https://cdn.sanity.io/images/proj123/production/')
    expect(url).toContain('w=400')
  })

  test('builds URL from populated media document with sanity.asset._id', () => {
    const mediaDoc = {
      id: 1,
      sanity: { asset: { _id: REF } },
      url: STORED,
    }

    const url = buildSanityImageUrl(mediaDoc, { client, width: 600 })
    expect(url).toContain('https://cdn.sanity.io/images/proj123/production/')
    expect(url).toContain('w=600')
  })

  test('returns null when populated media is marked deleted upstream', () => {
    const mediaDoc = {
      id: 1,
      sanity: { asset: { _id: REF } },
      url: null,
      sync: { status: 'deleted' as const },
    }

    expect(buildSanityImageUrl(mediaDoc, { client })).toBeNull()
  })

  test('rewrites host when cdnBaseUrl is set', () => {
    const ref = { _type: 'reference' as const, _ref: REF }

    const url = buildSanityImageUrl(ref, {
      client,
      cdnBaseUrl: 'https://images.example.com',
    })
    expect(url).toContain('https://images.example.com/')
  })

  test('applies width, height and fit to a flat asset URL without a client', () => {
    const url = buildSanityImageUrl({ url: STORED }, { width: 400, height: 300, fit: 'crop' })
    expect(url).toContain('w=400')
    expect(url).toContain('h=300')
    expect(url).toContain('fit=crop')
    expect(url).toContain('auto=format')
  })

  test('produces the same transform for flat, full and reference inputs', () => {
    const options = { client, width: 640, height: 480, fit: 'crop' as const }
    const flat = buildSanityImageUrl({ url: STORED }, { width: 640, height: 480, fit: 'crop' })
    const full = buildSanityImageUrl(
      { id: 1, url: STORED, sanity: { asset: { _id: REF } } },
      options
    )
    expect(flat).toContain('w=640')
    expect(full).toContain('w=640')
    expect(flat).toContain('fit=crop')
    expect(full).toContain('fit=crop')
  })

  test('keeps existing query parameters when adding transforms', () => {
    const url = buildSanityImageUrl({ url: `${STORED}?rect=1,2,3,4&dl=sample.jpg` }, { width: 200 })
    expect(url).toContain('dl=sample.jpg')
    expect(url).toContain('w=200')
  })

  test('sets quality and omits auto=format when autoFormat is false', () => {
    const url = buildSanityImageUrl({ url: STORED }, { quality: 70, autoFormat: false })
    expect(url).toContain('q=70')
    expect(url).not.toContain('auto=format')
  })

  test('leaves non-image file URLs unchanged', () => {
    expect(
      buildSanityImageUrl(
        { url: 'https://cdn.sanity.io/files/proj123/production/manual.pdf' },
        { width: 400 }
      )
    ).toBe('https://cdn.sanity.io/files/proj123/production/manual.pdf')
  })

  test('returns non-Sanity URLs unchanged', () => {
    expect(buildSanityImageUrl({ url: 'https://images.example.com/a.jpg' }, { width: 400 })).toBe(
      'https://images.example.com/a.jpg'
    )
  })

  test('throws when an asset reference needs a client and no URL is stored', () => {
    expect(() => buildSanityImageUrl(REF, { width: 400 })).toThrow(/SanityClient/)
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
