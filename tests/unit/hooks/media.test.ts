import { describe, expect, test } from 'bun:test'

import {
  createSanityMediaAfterReadHook,
  createSanityMediaBeforeChangeHook,
  createSanityMediaHydrateResponseAfterChangeHook,
  createSanityMediaPersistUpstreamBeforeChangeHook,
  SANITY_MEDIA_REPROCESS_CONTEXT_KEY,
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
      context: { sanityStorage: { skipPopulate: true } },
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
      context: { sanityStorage: { skipPopulate: true } },
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

  test('coerces null localized alt group to {} on create', async () => {
    const hook = createSanityMediaBeforeChangeHook({ localizedAltGroup: true })
    const result = await hook({
      data: {
        alt: null,
        filename: 'a.png',
        sanity: { id: 'image-a-png' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'create',
      req: {} as never,
    })

    expect(result?.alt).toEqual({})
  })
})

describe('createSanityMediaPersistUpstreamBeforeChangeHook', () => {
  test('restores sanity upstream fields stripped on metadata-only update', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const result = await hook({
      data: {
        alt: { en: 'New alt' },
        sanity: { id: 'image-abc' },
      },
      originalDoc: {
        id: 1,
        filename: 'image-abc',
        mimeType: 'image/jpeg',
        sanity: {
          id: 'image-abc',
          path: 'images/demo/production/abc.jpg',
          url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
        },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: { context: {} } as never,
    })

    expect(result?.sanity).toMatchObject({
      id: 'image-abc',
      path: 'images/demo/production/abc.jpg',
      url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
    })
    expect(result?.filename).toBe('image-abc')
    expect(result?.mimeType).toBe('image/jpeg')
  })

  test('sets skipCloudStorage on metadata-only update', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const req = { context: {} as Record<string, unknown> }

    await hook({
      data: { alt: { en: 'x' } },
      originalDoc: {
        id: 1,
        filename: 'image-abc',
        mimeType: 'image/jpeg',
        sanity: { id: 'image-abc', path: 'images/a.jpg' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: req as never,
    })

    expect(req.context.skipCloudStorage).toBe(true)
  })

  test('clears stale cloud-storage file context when update has no new bytes', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const req: {
      context: Record<string, unknown>
      file?: unknown
    } = {
      context: {
        _payloadCloudStorage: {
          file: { data: Buffer.from('stale') },
        },
      },
    }

    await hook({
      data: { alt: { en: 'x' } },
      originalDoc: {
        id: 1,
        filename: 'image-abc',
        mimeType: 'image/jpeg',
        sanity: { id: 'image-abc', path: 'images/a.jpg' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: req as never,
    })

    expect(req.file).toBeUndefined()
    expect(req.context._payloadCloudStorage).toBeUndefined()
  })

  test('preserves sizes and focal when omitted on metadata-only update', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const result = await hook({
      data: { name: 'Renamed' },
      originalDoc: {
        id: 1,
        filename: 'image-abc',
        focalX: 42,
        focalY: 58,
        sizes: { thumbnail: { filename: 'image-abc-300', width: 300, height: 200 } },
        sanity: { id: 'image-abc', path: 'images/a.jpg' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: { context: {} } as never,
    })

    expect(result).toMatchObject({
      focalX: 42,
      focalY: 58,
      sizes: { thumbnail: { filename: 'image-abc-300', width: 300, height: 200 } },
    })
  })

  test('does not set skipCloudStorage when uploadEdits crop is present', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const req = {
      context: {} as Record<string, unknown>,
      query: { uploadEdits: { crop: { x: 0, y: 0, width: 100, height: 100 } } },
      file: { data: Buffer.from('cropped') },
    }

    await hook({
      data: { width: 400, height: 300 },
      originalDoc: {
        id: 1,
        filename: 'image-old',
        width: 1200,
        height: 800,
        sanity: { id: 'image-old', path: 'images/a.jpg' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: req as never,
    })

    expect(req.context.skipCloudStorage).toBeUndefined()
  })

  test('keeps new width and height from generateFileData when uploadEdits crop is present', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const result = await hook({
      data: { width: 400, height: 300, focalX: 50, focalY: 50 },
      originalDoc: {
        id: 1,
        filename: 'image-old',
        width: 1200,
        height: 800,
        focalX: 10,
        focalY: 20,
        sanity: { id: 'image-old', path: 'images/a.jpg' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: {
        context: {},
        query: { uploadEdits: { crop: { x: 0, y: 0, width: 400, height: 300 } } },
        file: { data: Buffer.from('x') },
      } as never,
    })

    expect(result).toMatchObject({ width: 400, height: 300, focalX: 50, focalY: 50 })
  })

  test('passes through cloud-storage sanity metadata patch without merging stale upstream', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const result = await hook({
      data: {
        sanity: {
          id: 'image-new',
          path: 'images/demo/production/new.jpg',
          rev: 'rev-new',
        },
      },
      originalDoc: {
        id: 1,
        filename: 'image-old',
        sanity: {
          id: 'image-old',
          path: 'images/demo/production/old.jpg',
          rev: 'rev-old',
        },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: { context: { skipCloudStorage: true } } as never,
    })

    expect(result?.sanity).toMatchObject({
      id: 'image-new',
      path: 'images/demo/production/new.jpg',
      rev: 'rev-new',
    })
  })

  test('preserves sync status when admin omits sync group', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const result = await hook({
      data: { alt: { en: 'x' } },
      originalDoc: {
        id: 1,
        filename: 'image-abc',
        sanity: { id: 'image-abc', path: 'images/a.jpg' },
        sync: { status: 'deleted', checkedAt: '2020-01-01T00:00:00.000Z' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: { context: {} } as never,
    })

    expect(result?.sync?.status).toBe('deleted')
  })
})

describe('createSanityMediaHydrateResponseAfterChangeHook', () => {
  test('refreshes url and thumbnailURL after crop when afterRead ran with stale upstream', async () => {
    const hook = createSanityMediaHydrateResponseAfterChangeHook({
      cdnBaseUrl: 'https://cdn.sanity.io',
    })

    const result = await hook({
      data: {},
      doc: {
        id: '74bf748e-c528-44b0-80a7-f2b615fbe87a',
        filename: 'image-new-jpg',
        url: 'https://cdn.sanity.io/images/demo/production/old.jpg',
        thumbnailURL: 'https://cdn.sanity.io/images/demo/production/old.jpg?w=300',
        sanity: {
          id: 'image-new-jpg',
          path: 'images/demo/production/new.jpg',
          url: 'https://cdn.sanity.io/images/demo/production/new.jpg',
        },
        sync: { status: 'available' },
      },
      previousDoc: {
        id: '74bf748e-c528-44b0-80a7-f2b615fbe87a',
        filename: 'image-old-jpg',
        sanity: { id: 'image-old-jpg', path: 'images/demo/production/old.jpg' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: {
        context: { [SANITY_MEDIA_REPROCESS_CONTEXT_KEY]: true },
        query: { uploadEdits: { crop: { width: 100 } } },
      } as never,
    })

    expect(result?.url).toBe('https://cdn.sanity.io/images/demo/production/new.jpg')
    expect(result?.thumbnailURL).toContain('images/demo/production/new.jpg')
    expect(result?.thumbnailURL).toContain('w=300')
  })

  test('no-op on metadata-only update', async () => {
    const hook = createSanityMediaHydrateResponseAfterChangeHook()
    const doc = {
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
      sanity: { id: 'image-a', path: 'images/demo/production/a.jpg' },
      sync: { status: 'available' },
    }

    const result = await hook({
      data: {},
      doc,
      previousDoc: doc,
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: { context: {} } as never,
    })

    expect(result).toBe(doc)
  })
})

describe('media CRUD beforeChange sync', () => {
  test('does not force sync available when partial sanity id is sent on deleted asset', async () => {
    const hook = createSanityMediaBeforeChangeHook()
    const result = await hook({
      data: {
        sanity: { id: 'image-abc' },
        name: 'Label',
      },
      originalDoc: {
        id: 1,
        sanity: { id: 'image-abc', path: 'images/a.jpg' },
        sync: { status: 'deleted' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: {} as never,
    })

    expect(result?.sync?.status).toBe('deleted')
  })

  test('alt-only payload still normalizes sync on update when prior media exists', async () => {
    const before = createSanityMediaBeforeChangeHook()
    const persist = createSanityMediaPersistUpstreamBeforeChangeHook()
    const req = { context: {} } as never
    const originalDoc = {
      id: 1,
      filename: 'image-abc',
      mimeType: 'image/jpeg',
      sanity: {
        id: 'image-abc',
        path: 'images/demo/a.jpg',
        url: 'https://cdn.sanity.io/images/demo/a.jpg',
      },
      sync: { status: 'available' },
    }

    const afterBefore = await before({
      data: { alt: { en: 'New' } },
      originalDoc,
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req,
    })

    const afterPersist = await persist({
      data: afterBefore,
      originalDoc,
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req,
    })

    expect(afterPersist?.sanity).toMatchObject({
      id: 'image-abc',
      path: 'images/demo/a.jpg',
    })
    expect(afterPersist?.filename).toBe('image-abc')
  })
})
