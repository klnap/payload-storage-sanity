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
    })

    expect(sanitized.url).toBeNull()
    expect(sanitized.sync?.status).toBe('deleted')
  })

  test('keeps url when asset is available', () => {
    const sanitized = sanitizeMediaDocument({
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
      sync: { status: 'available' },
    })

    expect(sanitized.url).toBe('https://cdn.sanity.io/images/demo/production/a.jpg')
  })

  test('marks missing and clears url when asset id exists without CDN url', () => {
    const sanitized = sanitizeMediaDocument({
      id: 1,
      sanity_id: 'image-a-jpg',
      url: '',
      sync: { status: 'available' },
    })

    expect(sanitized.url).toBeNull()
    expect(sanitized.sync?.status as string).toBe('missing')
  })

  test('returns document as is when no asset id and no url exist', () => {
    const doc = { id: 1, name: 'blank' }
    const sanitized = sanitizeMediaDocument(doc)
    expect(sanitized).toEqual(doc)
  })
})

describe('createSanityMediaAfterReadHook', () => {
  test('returns sanitized document for drifted upstream assets without throwing', () => {
    const hook = createSanityMediaAfterReadHook()
    const result = hook({
      doc: {
        id: 2,
        sanity_id: 'image-missing-jpg',
        sync: { status: 'available' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      req: {} as never,
    })

    expect(result).toMatchObject({ url: null, sync: { status: 'missing' } })
  })
})

describe('createSanityMediaBeforeChangeHook', () => {
  test('initializes sync status on server and slugifies originalFilename; does NOT copy it to name', async () => {
    const hook = createSanityMediaBeforeChangeHook()
    const result = await hook({
      data: {
        filename: 'banner.png',
        originalFilename: 'hero banner.png',
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'create',
      req: {} as never,
    })

    // originalFilename must be slugified
    expect(result).toMatchObject({
      originalFilename: 'hero-banner.png',
      sync: {
        status: 'available',
      },
    })
    // name must NOT be auto-populated from originalFilename
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
