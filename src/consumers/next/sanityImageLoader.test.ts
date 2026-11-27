import { describe, expect, test } from 'bun:test'
import { createSanityImageLoader, sanityImageLoader } from './sanityImageLoader'

describe('sanityImageLoader', () => {
  test('adds responsive transformations to Sanity image URLs', () => {
    const url = sanityImageLoader({
      src: 'https://cdn.sanity.io/images/project/dataset/hero.jpg',
      width: 640,
      quality: 80,
    })
    const parsed = new URL(url)

    expect(parsed.searchParams.get('w')).toBe('640')
    expect(parsed.searchParams.get('q')).toBe('80')
    expect(parsed.searchParams.get('auto')).toBe('format')
  })

  test('leaves file URLs unchanged, even when their names look like images', () => {
    const url = 'https://cdn.sanity.io/files/project/dataset/photo.jpg'
    expect(sanityImageLoader({ src: url, width: 640 })).toBe(url)
  })

  test('supports configured CDN hosts', () => {
    const loader = createSanityImageLoader({ cdnBaseUrl: 'https://images.example.com' })
    const url = loader({
      src: 'https://images.example.com/images/project/dataset/hero.jpg',
      width: 640,
    })

    expect(new URL(url).searchParams.get('w')).toBe('640')
  })

  test('moves Sanity URLs to the configured origin before adding transformations', () => {
    const loader = createSanityImageLoader({ cdnBaseUrl: 'https://images.example.com' })
    const url = new URL(
      loader({ src: 'https://cdn.sanity.io/images/project/dataset/hero.jpg', width: 640 })
    )

    expect(url.origin).toBe('https://images.example.com')
    expect(url.pathname).toBe('/images/project/dataset/hero.jpg')
    expect(url.searchParams.get('w')).toBe('640')
  })

  test('does not rewrite Sanity URLs when no cdnBaseUrl is configured', () => {
    const url = sanityImageLoader({
      src: 'https://images.example.com/images/project/dataset/hero.jpg',
      width: 640,
    })
    expect(url).toBe('https://images.example.com/images/project/dataset/hero.jpg')
  })
})
