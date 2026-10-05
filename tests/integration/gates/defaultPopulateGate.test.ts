import { describe, expect, test } from 'bun:test'

import { createSanityMediaAfterReadHook } from '../../../src/hooks/media.js'
import { fullPopulate } from '../../../src/populate/fullPopulate.js'

const doc = {
  id: 5,
  filename: 'hero.jpg',
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
  test('applies default populate on REST and Local nested reads, not direct media document', () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'default',
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

    const adminNested = hook({
      doc,
      collection: { slug: 'media' } as never,
      context: {},
      findMany: true,
      req: {
        url: 'http://localhost:3000/api/globals/test?depth=1',
        payloadAPI: 'REST',
        user: { id: 'admin-1', collection: 'users' },
      } as never,
    })

    expect(adminNested).toHaveProperty('sanity')
    expect(adminNested).toMatchObject({ id: 5, filename: 'hero.jpg' })

    const localGlobal = hook({
      doc,
      collection: { slug: 'media' } as never,
      context: {},
      findMany: true,
      req: {
        url: 'http://localhost:3000/api/globals/home-page?depth=1',
        payloadAPI: 'local',
      } as never,
    })

    expect(localGlobal).toMatchObject({
      id: 5,
      url: 'https://cdn.sanity.io/images/demo/production/abc123-800x600.jpg',
      width: 800,
    })
    expect(localGlobal).not.toHaveProperty('sanity')
  })

  test('keeps full document on REST direct media route with UUID id', () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'default',
    })

    const uuid = '0babf185-2616-41ab-9fb0-1a7f752f5af8'
    const restDoc = hook({
      doc: { ...doc, id: uuid },
      collection: { slug: 'media' } as never,
      context: {},
      req: {
        url: `http://localhost:3000/api/media/${uuid}?locale=pl&depth=0`,
        payloadAPI: 'REST',
      } as never,
    })

    expect(restDoc).toHaveProperty('sanity')
    expect(restDoc).toMatchObject({
      id: uuid,
      filename: 'hero.jpg',
      url: expect.stringContaining('abc123-800x600.jpg'),
    })
  })

  test('skips morph when req.query.populate.media is explicit', () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'default',
    })

    const full = hook({
      doc,
      collection: { slug: 'media' } as never,
      context: {},
      findMany: true,
      req: {
        url: 'http://localhost:3000/api/globals/test?depth=1',
        payloadAPI: 'local',
        query: { populate: { media: fullPopulate() } },
      } as never,
    })

    expect(full).toHaveProperty('sanity')
    expect(full).toMatchObject({ id: 5, filename: 'hero.jpg' })
    expect(full).not.toMatchObject({ width: 800, aspectRatio: 1.33 })
  })

  test('skips morph for manual partial populate select', () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'default',
    })

    const partial = hook({
      doc,
      collection: { slug: 'media' } as never,
      context: {},
      findMany: true,
      req: {
        query: { populate: { media: { filename: true } } },
      } as never,
    })

    expect(partial).toMatchObject({ id: 5, filename: 'hero.jpg' })
    expect(partial).toHaveProperty('sanity')
  })

  test('admin keeps full document even with forcePopulate in context', () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'default',
    })

    const adminNested = hook({
      doc,
      collection: { slug: 'media' } as never,
      context: { sanityStorage: { forcePopulate: true } },
      findMany: true,
      req: {
        url: 'http://localhost:3000/api/globals/test?depth=1',
        payloadAPI: 'REST',
        user: { id: 'admin-1', collection: 'users' },
      } as never,
    })

    expect(adminNested).toHaveProperty('sanity')
    expect(adminNested).toMatchObject({ id: 5, filename: 'hero.jpg' })
    expect(adminNested).not.toMatchObject({ width: 800 })
  })
})
