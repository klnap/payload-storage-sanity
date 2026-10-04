import { describe, expect, test } from 'bun:test'

import {
  createSanityMediaAfterReadHook,
  createSanityMediaBeforeChangeHook,
  sanitizeMediaDocument,
} from '../../../src/hooks/media.js'

describe('sanitizeMediaDocument', () => {
  test('clears url when sync status is deleted', () => {
    const sanitized = sanitizeMediaDocument({
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
      sync: { status: 'deleted' },
      sanity: {
        path: 'images/demo/production/a.jpg',
        url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
      },
    })

    expect(sanitized.url).toBeNull()
    expect(sanitized.sync?.status).toBe('deleted')
  })

  test('keeps url when asset is available with upstream locators', () => {
    const sanitized = sanitizeMediaDocument({
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
      sync: { status: 'available' },
      sanity: {
        path: 'images/demo/production/a.jpg',
        url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
      },
    })

    expect(sanitized.url).toBe('https://cdn.sanity.io/images/demo/production/a.jpg')
  })

  test('marks missing and clears url when asset id exists without path or url', () => {
    const sanitized = sanitizeMediaDocument({
      id: 1,
      sanity: { id: 'image-a-jpg' },
      url: '',
      sync: { status: 'available' },
    })

    expect(sanitized.url).toBeNull()
    expect(sanitized.sync?.status as string).toBe('missing')
  })

  test('returns document as is when no asset id and no upstream locators exist', () => {
    const doc = { id: 1, name: 'blank' }
    const sanitized = sanitizeMediaDocument(doc)
    expect(sanitized).toEqual(doc)
  })
})

describe('createSanityMediaAfterReadHook', () => {
  test('hydrates root url from sanity.path and marks missing when locators absent', () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'full',
      registry: {},
    })

    const hydrated = hook({
      doc: {
        id: 2,
        sanity: {
          id: 'image-missing-jpg',
          path: 'images/demo/production/missing.jpg',
          url: 'https://cdn.sanity.io/images/demo/production/missing.jpg',
        },
        sync: { status: 'available' },
      },
      collection: { slug: 'media' } as never,
      context: { sanitySkipDefaultPopulate: true },
      req: { url: 'http://localhost:3000/api/media/2' } as never,
    })

    expect(hydrated).toMatchObject({
      url: 'https://cdn.sanity.io/images/demo/production/missing.jpg',
    })

    const missing = hook({
      doc: {
        id: 3,
        sanity: { id: 'image-missing-jpg' },
        sync: { status: 'available' },
      },
      collection: { slug: 'media' } as never,
      context: { sanitySkipDefaultPopulate: true },
      req: { url: 'http://localhost:3000/api/media/3' } as never,
    })

    expect(missing).toMatchObject({ url: null, sync: { status: 'missing' } })
  })
})

describe('createSanityMediaBeforeChangeHook', () => {
  test('initializes sync status on server and slugifies originalFilename; does NOT copy it to name', async () => {
    const hook = createSanityMediaBeforeChangeHook()
    const result = await hook({
      data: {
        filename: 'banner.png',
        originalFilename: 'hero banner.png',
        sanity: { id: 'image-a-png' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'create',
      req: {} as never,
    })

    expect(result).toMatchObject({
      originalFilename: 'hero-banner.png',
      sync: {
        status: 'available',
      },
    })
    expect((result as Record<string, unknown>)['name']).toBeUndefined()
    expect(typeof result?.sync?.checkedAt).toBe('string')
  })

  test('leaves sync empty when no media or file has been provided yet', async () => {
    const hook = createSanityMediaBeforeChangeHook()
    const result = await hook({
      data: {
        name: 'Draft Title',
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'create',
      req: {} as never,
    })

    expect(result?.sync).toBeUndefined()
  })
})
