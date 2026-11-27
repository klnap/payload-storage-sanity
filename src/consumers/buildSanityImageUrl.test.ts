import { describe, expect, test } from 'bun:test'
import { buildSanityImageUrl } from './buildSanityImageUrl'

const image = {
  id: 'media-1',
  url: 'https://cdn.sanity.io/images/project/dataset/hero-1200x800.jpg',
  alt: 'Hero',
  focalX: 50,
  focalY: 50,
}

describe('buildSanityImageUrl', () => {
  test('builds transformations for a normalized image asset', () => {
    const url = buildSanityImageUrl(image, { width: 640, quality: 80 })
    if (!url) throw new Error('Expected an image URL')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('w')).toBe('640')
    expect(parsed.searchParams.get('auto')).toBe('format')
  })

  test('never adds image transformations to Sanity file URLs', () => {
    const url = 'https://cdn.sanity.io/files/project/dataset/photo.jpg'
    expect(buildSanityImageUrl({ ...image, url }, { width: 640 })).toBe(url)
  })

  test('does not resolve a Sanity file reference as an image', () => {
    expect(buildSanityImageUrl({ _type: 'reference', _ref: 'file-abc-pdf' })).toBeNull()
  })

  describe('cdnBaseUrl contract', () => {
    const CUSTOM = 'https://images.example.com'

    test('moves a stored cdn.sanity.io image URL to the configured origin and transforms it', () => {
      const url = new URL(buildSanityImageUrl(image, { cdnBaseUrl: CUSTOM, width: 640 }) ?? '')
      expect(url.origin).toBe(CUSTOM)
      expect(url.pathname).toBe('/images/project/dataset/hero-1200x800.jpg')
      expect(url.searchParams.get('w')).toBe('640')
    })

    test('transforms a stored URL that already uses the configured origin', () => {
      const url = new URL(
        buildSanityImageUrl(
          { ...image, url: `${CUSTOM}/images/project/dataset/hero-1200x800.jpg` },
          { cdnBaseUrl: CUSTOM, width: 640 }
        ) ?? ''
      )
      expect(url.origin).toBe(CUSTOM)
      expect(url.searchParams.get('w')).toBe('640')
    })

    test('moves a Sanity file URL to the configured origin without image transformations', () => {
      const url = buildSanityImageUrl(
        { ...image, url: 'https://cdn.sanity.io/files/project/dataset/photo.pdf' },
        { cdnBaseUrl: CUSTOM, width: 640 }
      )
      expect(url).toBe(`${CUSTOM}/files/project/dataset/photo.pdf`)
    })

    test('leaves unrelated URLs unchanged', () => {
      const foreign = 'https://example.org/images/photo.jpg'
      expect(
        buildSanityImageUrl({ ...image, url: foreign }, { cdnBaseUrl: CUSTOM, width: 640 })
      ).toBe(foreign)
    })
  })
})
