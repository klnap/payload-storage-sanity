import { describe, expect, test } from 'bun:test'

import { parseSanityImageAsset } from '../../../src/utils/parseSanityImageAsset.js'

describe('parseSanityImageAsset', () => {
  const valid = {
    _id: 'image-abc123-800x600-jpg',
    _type: 'sanity.imageAsset',
    assetId: 'abc123',
    extension: 'jpg',
    mimeType: 'image/jpeg',
    originalFilename: 'pic.jpg',
    path: 'images/demo/abc123-800x600.jpg',
    sha1hash: 'abc123hash',
    size: 1024,
    url: 'https://cdn.sanity.io/images/demo/production/abc123-800x600.jpg',
  }

  test('accepts a valid Sanity image asset document', () => {
    const parsed = parseSanityImageAsset(valid)
    expect(parsed).not.toBeNull()
    expect(parsed?._id).toBe('image-abc123-800x600-jpg')
    expect(parsed?.assetId).toBe('abc123')
  })

  test('parses full metadata including palette, LQIP, geolocation, and EXIF', () => {
    const full = {
      ...valid,
      metadata: {
        dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
        lqip: 'data:image/jpeg;base64,123',
        blurHash: 'VKQJcdog',
        palette: {
          dominant: { background: '#000', foreground: '#fff', population: 1, title: '#fff' },
        },
        location: { _type: 'geopoint', lat: 52.1, lng: 21.0, alt: 100 },
        exif: { Make: 'Nikon' },
      },
    }

    const parsed = parseSanityImageAsset(full)
    expect(parsed?.metadata?.dimensions?.width).toBe(800)
    expect(parsed?.metadata?.location?.lat).toBe(52.1)
    expect(parsed?.metadata?.location?.alt).toBe(100)
    expect(parsed?.metadata?.palette?.dominant?.background).toBe('#000')
  })

  test('rejects invalid shapes', () => {
    expect(parseSanityImageAsset(null)).toBeNull()
    expect(parseSanityImageAsset({})).toBeNull()
    expect(parseSanityImageAsset({ _id: 'not-an-image' })).toBeNull()
  })

  test('rejects metadata with invalid palette swatch fields', () => {
    const invalid = {
      ...valid,
      metadata: {
        palette: {
          dominant: { background: 123 }, // background must be string
        },
      },
    }
    expect(parseSanityImageAsset(invalid)).toBeNull()
  })

  test('rejects metadata with invalid geolocation coordinates', () => {
    const invalid = {
      ...valid,
      metadata: {
        location: { lat: 'invalid', lng: 'invalid' },
      },
    }
    expect(parseSanityImageAsset(invalid)).toBeNull()
  })
})
