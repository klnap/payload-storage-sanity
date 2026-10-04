import { describe, expect, test } from 'bun:test'

import { createSanityMediaAfterReadHook } from '../../../src/hooks/media.js'

const doc = {
  id: 5,
  focalX: 10,
  focalY: 20,
  alt: 'Hero',
  sync: { status: 'available' as const },
  sanity: {
    id: 'image-abc123-800x600-jpg',
    type: 'sanity.imageAsset',
    path: 'images/demo/production/abc123-800x600.jpg',
    url: 'https://cdn.sanity.io/images/demo/production/abc123-800x600.jpg',
    source: 'dataset' as const,
    metadata: {
      dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
      lqip: 'data:image/jpeg;base64,x',
    },
  },
}

describe('defaultPopulateGate', () => {
  test('applies default populate on REST but not admin local reads', () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'default',
      registry: {},
    })

    const populated = hook({
      doc,
      collection: { slug: 'media' } as never,
      context: {},
      findMany: true,
      req: {
        url: 'http://localhost:3000/api/globals/test?depth=1',
        payloadAPI: 'REST',
      } as never,
    })

    expect(populated).toMatchObject({
      id: 5,
      url: 'https://cdn.sanity.io/images/demo/production/abc123-800x600.jpg',
      width: 800,
      focalX: 10,
    })
    expect(populated).not.toHaveProperty('sanity')

    const adminDoc = hook({
      doc,
      collection: { slug: 'media' } as never,
      context: {},
      req: {
        url: 'http://localhost:3000/api/media/5',
        payloadAPI: 'local',
      } as never,
    })

    expect(adminDoc).toHaveProperty('sanity')
    expect(adminDoc).toMatchObject({ id: 5, url: expect.stringContaining('abc123-800x600.jpg') })
  })
})
