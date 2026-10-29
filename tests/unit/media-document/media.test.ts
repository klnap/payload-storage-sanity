import { describe, expect, test } from 'bun:test'

import {
  createSanityMediaAfterReadHook,
  createSanityMediaBeforeChangeHook,
  createSanityMediaHydrateResponseAfterChangeHook,
  createSanityMediaPersistUpstreamBeforeChangeHook,
  SANITY_MEDIA_REPROCESS_CONTEXT_KEY,
  sanitizeMediaDocument,
} from '@/features/media/document'

describe('sanitizeMediaDocument', () => {
  test('clears url when sync status is deleted', () => {
    const sanitized = sanitizeMediaDocument({
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
      sync: { status: 'deleted' },
      sanity: {
        asset: {
          path: 'images/demo/production/a.jpg',
          url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
        },
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
        asset: {
          path: 'images/demo/production/a.jpg',
          url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
        },
      },
    })

    expect(sanitized.url).toBe('https://cdn.sanity.io/images/demo/production/a.jpg')
  })

  test('marks missing and clears url when asset id exists without path or url', () => {
    const sanitized = sanitizeMediaDocument({
      id: 1,
      sanity: { asset: { _id: 'image-a-jpg' } },
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

  test('upgrades placeholder unknown to available when upstream locators exist', () => {
    const sanitized = sanitizeMediaDocument({
      id: 1,
      url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
      sync: { status: 'unknown', checkedAt: '2026-01-01T00:00:00.000Z' },
      sanity: {
        asset: {
          path: 'images/demo/production/a.jpg',
          url: 'https://cdn.sanity.io/images/demo/production/a.jpg',
        },
      },
    })

    expect(sanitized.sync?.status as string).toBe('available')
    expect(sanitized.sync?.checkedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  test('strips _objectKey and empty sanityAssetMeta from payloads', () => {
    const sanitized = sanitizeMediaDocument({
      id: 1,
      name: 'blank',
      _objectKey: null,
      sanityAssetMeta: {},
    } as Parameters<typeof sanitizeMediaDocument>[0])

    expect(sanitized).toEqual({ id: 1, name: 'blank' } as typeof sanitized)
    expect('_objectKey' in sanitized).toBe(false)
    expect('sanityAssetMeta' in sanitized).toBe(false)
  })
})

describe('createSanityMediaAfterReadHook', () => {
  test('hydrates root url from sanity.path and marks missing when locators absent', async () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'full',
    })

    const hydrated = await hook({
      doc: {
        id: 2,
        sanity: {
          asset: {
            _id: 'image-missing-jpg',
            path: 'images/demo/production/missing.jpg',
            url: 'https://cdn.sanity.io/images/demo/production/missing.jpg',
          },
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

    const missing = await hook({
      doc: {
        id: 3,
        sanity: { asset: { _id: 'image-missing-jpg' } },
        sync: { status: 'available' },
      },
      collection: { slug: 'media' } as never,
      context: { sanityStorage: { skipPopulate: true } },
      req: { url: 'http://localhost:3000/api/media/3' } as never,
    })

    expect(missing).toMatchObject({ url: null, sync: { status: 'missing' } })
  })

  test('keeps persisted url when REST populate omits sanity group (SDK defaultPopulate)', async () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'default',
    })

    const hydrated = await hook({
      doc: {
        id: 'b002c0e7-0781-48e5-b1ef-00a96658cc10',
        filename: 'hero.jpg',
        width: 800,
        height: 600,
        url: 'https://cdn.sanity.io/images/demo/production/hero.jpg',
        sync: { status: 'available' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      req: {
        url: 'http://localhost:4000/api/globals/home-page?depth=2&locale=pl',
        payloadAPI: 'REST',
      } as never,
    })

    expect(hydrated).toMatchObject({
      url: 'https://cdn.sanity.io/images/demo/production/hero.jpg',
    })
  })

  test('derives url from thumbnailURL when primary url was cleared', async () => {
    const hook = createSanityMediaAfterReadHook({
      collectionSlug: 'media',
      resolvedPreset: 'default',
    })

    const hydrated = await hook({
      doc: {
        id: '1',
        filename: 'hero.jpg',
        url: null,
        thumbnailURL:
          'https://cdn.sanity.io/images/demo/production/hero.jpg?w=300&fit=max&auto=format',
        sync: { status: 'available' },
      },
      collection: { slug: 'media' } as never,
      context: {},
      req: {
        url: 'http://localhost:4000/api/globals/home-page?depth=2',
        payloadAPI: 'REST',
      } as never,
    })

    expect(hydrated).toMatchObject({
      url: 'https://cdn.sanity.io/images/demo/production/hero.jpg',
    })
  })
})

describe('createSanityMediaBeforeChangeHook', () => {
  test('initializes sync status on server; does NOT copy filename to name', async () => {
    const hook = createSanityMediaBeforeChangeHook()
    const result = await hook({
      data: {
        filename: 'banner.png',
        originalFilename: 'hero banner.png',
        sanity: { asset: { _id: 'image-a-png' } },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'create',
      req: {} as never,
    })

    expect(result).toMatchObject({
      sync: {
        status: 'available',
      },
    })
    expect((result as Record<string, unknown>).name).toBeUndefined()
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
        sanity: { asset: { _id: 'image-a-png' } },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'create',
      req: {} as never,
    })

    expect(result?.alt).toEqual({})
  })

  test('replaces unknown sync status with available on create when asset exists', async () => {
    const hook = createSanityMediaBeforeChangeHook()
    const result = await hook({
      data: {
        filename: 'image-a-png',
        sync: { status: 'unknown', checkedAt: '2026-01-01T00:00:00.000Z' },
        sanity: {
          asset: {
            _id: 'image-a-png',
            path: 'images/demo/a.png',
            url: 'https://cdn.sanity.io/images/demo/a.png',
          },
        },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'create',
      req: {} as never,
    })

    expect(result?.sync?.status).toBe('available')
  })

  test('strips legacy sanityAssetMeta and _objectKey on save', async () => {
    const hook = createSanityMediaBeforeChangeHook()
    const result = await hook({
      data: {
        filename: 'a.png',
        sanity: { asset: { _id: 'image-a-png' } },
        _objectKey: null,
        sanityAssetMeta: { file: { size: 1 } },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'create',
      req: {} as never,
    })

    expect('_objectKey' in (result as object)).toBe(false)
    expect('sanityAssetMeta' in (result as object)).toBe(false)
    expect(result?.sanity).toEqual({ asset: { _id: 'image-a-png' } })
  })
})

describe('createSanityMediaPersistUpstreamBeforeChangeHook', () => {
  test('restores sanity upstream fields stripped on metadata-only update', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const result = await hook({
      data: {
        alt: { en: 'New alt' },
        sanity: { asset: { _id: 'image-abc' } },
      },
      originalDoc: {
        id: 1,
        filename: 'image-abc',
        mimeType: 'image/jpeg',
        sanity: {
          asset: {
            _id: 'image-abc',
            path: 'images/demo/production/abc.jpg',
            url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
          },
        },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: { context: {} } as never,
    })

    expect(result?.sanity?.asset).toMatchObject({
      _id: 'image-abc',
      path: 'images/demo/production/abc.jpg',
      url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
    })
    expect(result?.filename).toBe('image-abc')
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
        sanity: { asset: { _id: 'image-abc', path: 'images/a.jpg' } },
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
        sanity: { asset: { _id: 'image-abc', path: 'images/a.jpg' } },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: req as never,
    })

    expect(req.file).toBeUndefined()
    expect(req.context._payloadCloudStorage).toBeUndefined()
  })

  test('preserves focal when omitted on metadata-only update', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const result = await hook({
      data: { name: 'Renamed' },
      originalDoc: {
        id: 1,
        filename: 'image-abc',
        focalX: 42,
        focalY: 58,
        sanity: { asset: { _id: 'image-abc', path: 'images/a.jpg' } },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: { context: {} } as never,
    })

    expect(result).toMatchObject({
      focalX: 42,
      focalY: 58,
    })
  })

  test('sets skipCloudStorage on focal-only uploadEdits even with stale req.file', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const req = {
      context: {} as Record<string, unknown>,
      query: {
        uploadEdits: {
          crop: { unit: '%', x: 0, y: 0, width: 100, height: 100 },
          focalPoint: { x: 22, y: 44 },
          widthInPixels: 1200,
          heightInPixels: 800,
        },
      },
      file: { data: Buffer.from('refetched-from-cdn') },
    }

    await hook({
      data: { focalX: 22, focalY: 44 },
      originalDoc: {
        id: 1,
        filename: 'image-old',
        width: 1200,
        height: 800,
        focalX: 10,
        focalY: 20,
        sanity: { asset: { _id: 'image-old', path: 'images/a.jpg' } },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: req as never,
    })

    expect(req.context.skipCloudStorage).toBe(true)
    expect(req.file).toBeUndefined()
  })

  test('does not set skipCloudStorage when uploadEdits crop is present', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const req = {
      context: {} as Record<string, unknown>,
      query: {
        uploadEdits: { crop: { unit: '%', x: 0, y: 0, width: 50, height: 100 } },
      },
      file: { data: Buffer.from('cropped') },
    }

    await hook({
      data: { width: 400, height: 300 },
      originalDoc: {
        id: 1,
        filename: 'image-old',
        width: 1200,
        height: 800,
        sanity: { asset: { _id: 'image-old', path: 'images/a.jpg' } },
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
        sanity: { asset: { _id: 'image-old', path: 'images/a.jpg' } },
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
          asset: {
            _id: 'image-new',
            path: 'images/demo/production/new.jpg',
            _rev: 'rev-new',
          },
        },
      },
      originalDoc: {
        id: 1,
        filename: 'image-old',
        sanity: {
          asset: {
            _id: 'image-old',
            path: 'images/demo/production/old.jpg',
            _rev: 'rev-old',
          },
        },
      },
      collection: { slug: 'media' } as never,
      context: {},
      operation: 'update',
      req: { context: { skipCloudStorage: true } } as never,
    })

    expect(result?.sanity?.asset).toMatchObject({
      _id: 'image-new',
      path: 'images/demo/production/new.jpg',
      _rev: 'rev-new',
    })
  })

  test('preserves sync status when admin omits sync group', async () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()
    const result = await hook({
      data: { alt: { en: 'x' } },
      originalDoc: {
        id: 1,
        filename: 'image-abc',
        sanity: { asset: { _id: 'image-abc', path: 'images/a.jpg' } },
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
          asset: {
            _id: 'image-new-jpg',
            path: 'images/demo/production/new.jpg',
            url: 'https://cdn.sanity.io/images/demo/production/new.jpg',
          },
        },
        sync: { status: 'available' },
      },
      previousDoc: {
        id: '74bf748e-c528-44b0-80a7-f2b615fbe87a',
        filename: 'image-old-jpg',
        sanity: { asset: { _id: 'image-old-jpg', path: 'images/demo/production/old.jpg' } },
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
      sanity: { asset: { _id: 'image-a', path: 'images/demo/production/a.jpg' } },
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
        sanity: { asset: { _id: 'image-abc' } },
        name: 'Label',
      },
      originalDoc: {
        id: 1,
        sanity: { asset: { _id: 'image-abc', path: 'images/a.jpg' } },
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
        asset: {
          _id: 'image-abc',
          path: 'images/demo/a.jpg',
          url: 'https://cdn.sanity.io/images/demo/a.jpg',
        },
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

    expect(afterPersist?.sanity?.asset).toMatchObject({
      _id: 'image-abc',
      path: 'images/demo/a.jpg',
    })
    expect(afterPersist?.filename).toBe('image-abc')
  })
})
