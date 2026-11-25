import { describe, expect, test } from 'bun:test'

import { resolveHydratedMediaUrls } from '@/features/media/cdn'
import { deriveBaseCdnUrlFromThumbnail } from '@/sanity/cdn'

describe('deriveBaseCdnUrlFromThumbnail', () => {
  test('strips Sanity transform query params', () => {
    expect(
      deriveBaseCdnUrlFromThumbnail(
        'https://cdn.sanity.io/images/demo/production/a.jpg?w=300&fit=max&auto=format'
      )
    ).toBe('https://cdn.sanity.io/images/demo/production/a.jpg')
  })
})

describe('resolveHydratedMediaUrls', () => {
  test('derives primary url from thumbnail when sanity group is absent', () => {
    const { url, thumbnailURL } = resolveHydratedMediaUrls({
      id: '1',
      filename: 'hero.jpg',
      url: null,
      thumbnailURL:
        'https://cdn.sanity.io/images/demo/production/hero.jpg?w=300&fit=max&auto=format',
      sync: { status: 'available' },
    } as never)

    expect(thumbnailURL).toContain('w=300')
    expect(url).toBe('https://cdn.sanity.io/images/demo/production/hero.jpg')
  })
})
