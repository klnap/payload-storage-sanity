import { describe, expect, test } from 'bun:test'

import {
  createSanityAssetFetchCache,
  SanityAssetFetchCache,
} from '../../../src/utils/sanityAssetCache.js'

describe('SanityAssetFetchCache', () => {
  test('caches in-flight promises and tracks size', async () => {
    const cache = createSanityAssetFetchCache()
    expect(cache).toBeInstanceOf(SanityAssetFetchCache)
    expect(cache.size).toBe(0)

    const promise = Promise.resolve({
      status: 'available' as const,
      asset: { _id: 'image-1' } as never,
    })
    cache.set('image-1', promise)

    expect(cache.get('image-1')).toBe(promise)
    expect(cache.size).toBe(1)

    cache.delete('image-1')
    expect(cache.get('image-1')).toBeUndefined()
    expect(cache.size).toBe(0)

    cache.set('image-2', promise)
    cache.clear()
    expect(cache.size).toBe(0)
  })
})
