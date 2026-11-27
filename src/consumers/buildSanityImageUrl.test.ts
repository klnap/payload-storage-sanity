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
})
