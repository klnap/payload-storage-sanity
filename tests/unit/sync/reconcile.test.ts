import { describe, expect, mock, test } from 'bun:test'

import { reconcileSanityMedia } from '../../../src/sync/reconcile.js'

describe('reconcileSanityMedia', () => {
  test('marks media unavailable when Sanity asset is missing', async () => {
    const find = mock(async () => ({
      docs: [{ id: 3, sanity: { id: 'image-missing-jpg' }, sync: { status: 'available' } }],
      hasNextPage: false,
    }))
    const findByID = mock(async () => ({
      id: 3,
      sanity: { id: 'image-missing-jpg' },
      sync: { status: 'available' },
    }))
    const update = mock(async () => ({}))

    const client = {
      getDocument: mock(async () => null),
    }

    const report = await reconcileSanityMedia({
      payload: { find, findByID, update } as never,
      client: client as never,
      collectionSlug: 'media',
      dryRun: false,
    })

    expect(report.markedUnavailable).toBe(1)
    expect(update).toHaveBeenCalled()
  })

  test('supports dry run without writes', async () => {
    const find = mock(async () => ({
      docs: [{ id: 3, sanity: { id: 'image-missing-jpg' }, sync: { status: 'available' } }],
      hasNextPage: false,
    }))
    const update = mock(async () => ({}))

    const client = {
      getDocument: mock(async () => null),
    }

    const report = await reconcileSanityMedia({
      payload: { find, update } as never,
      client: client as never,
      collectionSlug: 'media',
      dryRun: true,
    })

    expect(report.dryRun).toBe(true)
    expect(report.markedUnavailable).toBe(1)
    expect(update).not.toHaveBeenCalled()
  })

  test('reports duplicates in dry run', async () => {
    const find = mock(async () => ({
      docs: [
        {
          id: 'older',
          createdAt: '2024-01-01T00:00:00.000Z',
          sanity: { id: 'image-dup', sha1hash: 'same' },
          sync: { status: 'available' },
        },
        {
          id: 'newer',
          createdAt: '2024-06-01T00:00:00.000Z',
          sanity: { id: 'image-dup', sha1hash: 'same' },
          sync: { status: 'available' },
        },
      ],
      hasNextPage: false,
    }))
    const update = mock(async () => ({}))
    const client = {
      getDocument: mock(async (id: string) => ({
        _id: id,
        _type: 'sanity.imageAsset',
        assetId: id,
        url: `https://cdn.sanity.io/images/demo/production/${id}.jpg`,
        mimeType: 'image/jpeg',
      })),
    }

    const report = await reconcileSanityMedia({
      payload: { find, update } as never,
      client: client as never,
      collectionSlug: 'media',
      dryRun: true,
    })

    expect(report.duplicates).toBe(1)
    expect(update).not.toHaveBeenCalled()
  })

  test('records row errors without aborting the batch', async () => {
    const find = mock(async () => ({
      docs: [
        { id: 3, sanity: { id: 'image-broken-jpg' }, sync: { status: 'available' } },
        { id: 4, sanity: { id: 'image-ok-jpg' }, sync: { status: 'available' } },
      ],
      hasNextPage: false,
    }))
    const update = mock(async ({ id }: { id: number }) => {
      if (id === 3) throw new Error('write failed')
      return {}
    })

    const client = {
      getDocument: mock(async (id: string) => ({
        _id: id,
        _type: 'sanity.imageAsset',
        assetId: id.replace(/^image-/, ''),
        url: `https://cdn.sanity.io/images/demo/production/${id}.jpg`,
        mimeType: 'image/jpeg',
        originalFilename: `${id}.jpg`,
      })),
    }

    const report = await reconcileSanityMedia({
      payload: { find, update, logger: { error: mock(() => {}) } } as never,
      client: client as never,
      collectionSlug: 'media',
      dryRun: false,
    })

    expect(report.errors).toBe(1)
    expect(report.synced).toBe(1)
    expect(report.rows).toHaveLength(2)
  })

  test('paginates through all media batches', async () => {
    let page = 0
    const find = mock(async () => {
      page += 1
      if (page === 1) {
        return {
          docs: [{ id: 1, sanity: { id: 'image-a-jpg' }, sync: { status: 'available' } }],
          hasNextPage: true,
        }
      }
      return {
        docs: [{ id: 2, sanity: { id: 'image-b-jpg' }, sync: { status: 'available' } }],
        hasNextPage: false,
      }
    })

    const update = mock(async () => ({}))
    const client = {
      getDocument: mock(async (id: string) => ({
        _id: id,
        _type: 'sanity.imageAsset',
        assetId: id,
        url: `https://cdn.sanity.io/images/demo/production/${id}.jpg`,
        mimeType: 'image/jpeg',
      })),
    }

    const report = await reconcileSanityMedia({
      payload: { find, update } as never,
      client: client as never,
      collectionSlug: 'media',
      limit: 1,
    })

    expect(find).toHaveBeenCalledTimes(2)
    expect(report.scanned).toBe(2)
    expect(report.synced).toBe(2)
  })

  test('syncs media row with UUID document id', async () => {
    const uuid = '0babf185-2616-41ab-9fb0-1a7f752f5af8'
    const find = mock(async () => ({
      docs: [{ id: uuid, sanity: { id: 'image-uuid-jpg' }, sync: { status: 'available' } }],
      hasNextPage: false,
    }))
    const update = mock(async () => ({}))

    const client = {
      getDocument: mock(async () => ({
        _id: 'image-uuid-jpg',
        _type: 'sanity.imageAsset',
        assetId: 'uuid',
        url: 'https://cdn.sanity.io/images/demo/production/uuid.jpg',
        mimeType: 'image/jpeg',
      })),
    }

    const report = await reconcileSanityMedia({
      payload: { find, update } as never,
      client: client as never,
      collectionSlug: 'media',
      dryRun: false,
    })

    expect(report.skipped).toBe(0)
    expect(report.synced).toBe(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: uuid })
    )
  })

  test('syncs modified upstream assets into Payload media rows', async () => {
    const find = mock(async () => ({
      docs: [{ id: 8, sanity: { id: 'image-modified-jpg' }, sync: { status: 'available' } }],
      hasNextPage: false,
    }))
    const update = mock(async () => ({}))

    const client = {
      getDocument: mock(async () => ({
        _id: 'image-modified-jpg',
        _type: 'sanity.imageAsset',
        assetId: 'modified',
        path: 'images/demo/production/modified-v2.jpg',
        url: 'https://cdn.sanity.io/images/demo/production/modified-v2.jpg',
        mimeType: 'image/jpeg',
        metadata: { dimensions: { width: 1024, height: 768, aspectRatio: 1.33 } },
      })),
    }

    const report = await reconcileSanityMedia({
      payload: { find, update } as never,
      client: client as never,
      collectionSlug: 'media',
    })

    expect(report.synced).toBe(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 8,
        data: expect.objectContaining({
          sanity: expect.objectContaining({
            url: 'https://cdn.sanity.io/images/demo/production/modified-v2.jpg',
            metadata: expect.objectContaining({
              dimensions: { width: 1024, height: 768, aspectRatio: 1.33 },
            }),
          }),
        }),
      })
    )
  })

  test('skips media rows without a Sanity asset id', async () => {
    const find = mock(async () => ({
      docs: [{ id: 10, sync: { status: 'available' } }],
      hasNextPage: false,
    }))
    const update = mock(async () => ({}))

    const report = await reconcileSanityMedia({
      payload: { find, update } as never,
      client: { getDocument: mock(async () => null) } as never,
      collectionSlug: 'media',
    })

    expect(report.skipped).toBe(1)
    expect(update).not.toHaveBeenCalled()
  })
})
