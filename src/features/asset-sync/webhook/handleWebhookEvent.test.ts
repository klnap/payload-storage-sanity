import { describe, expect, mock, test } from 'bun:test'

import { handleSanityWebhookEvent } from '@/features/asset-sync'

/** Postgres-shaped database: the webhook delete runs in one transaction that takes the asset lock. */
function postgresDb() {
  const execute = async (query: string) =>
    query.includes('transaction_isolation')
      ? { rows: [{ transaction_isolation: 'read committed' }] }
      : { rows: [] }
  return {
    packageName: '@payloadcms/db-postgres',
    beginTransaction: mock(async () => 'tx-1'),
    commitTransaction: mock(async () => undefined),
    rollbackTransaction: mock(async () => undefined),
    sessions: { 'tx-1': { db: { execute } } },
  }
}

describe('handleSanityWebhookEvent', () => {
  test('marks deleted image assets as deleted', async () => {
    const update = mock(async () => ({}))
    const findByID = mock(async () => ({
      id: 7,
      sanity: { asset: { _id: 'image-a-jpg' } },
      sync: {},
    }))
    const find = mock(async () => ({
      docs: [{ id: 7 }],
      hasNextPage: false,
    }))

    const payload = {
      find,
      findByID,
      update,
      delete: mock(async () => ({})),
    }

    const result = await handleSanityWebhookEvent({
      payload: payload as never,
      client: {} as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: { ids: { deleted: ['image-a-jpg'] }, projectId: 'demo', dataset: 'production' },
      onDeleted: 'mark',
    })

    expect(result.deleted).toBe(1)
    expect(update).toHaveBeenCalled()
  })

  test('continues when a media delete fails', async () => {
    const update = mock(async () => ({}))
    const find = mock(async () => ({
      docs: [{ id: 7 }],
      hasNextPage: false,
    }))

    const payload = {
      db: postgresDb(),
      find,
      findByID: mock(async () => ({ id: 7 })),
      update,
      delete: mock(async () => {
        throw new Error('delete failed')
      }),
      logger: { error: mock(() => {}) },
    }

    const client = { getDocument: mock(async () => undefined) }

    const result = await handleSanityWebhookEvent({
      payload: payload as never,
      client: client as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: {
        ids: { deleted: ['image-f91b77612953a5e5b5bf9de08c016b9c6844ee0e-800x600-jpg'] },
        projectId: 'demo',
        dataset: 'production',
      },
      onDeleted: 'delete',
    })

    // A failed Payload row delete does not acknowledge the Sanity deletion event.
    expect(result.deleted).toBe(0)
    expect(result.errors).toBe(1)
  })

  test('keeps media when upstream still reports the deleted asset as available', async () => {
    const update = mock(async () => ({}))
    const remove = mock(async () => ({}))
    const clientDelete = mock(async () => {})
    const client = {
      getDocument: mock(async () => ({
        _id: 'image-a-jpg',
        _type: 'sanity.imageAsset',
        assetId: 'a',
        url: 'https://cdn.sanity.io/images/p/d/a-1x1.jpg',
      })),
      delete: clientDelete,
    }
    const payload = {
      find: mock(async () => ({ docs: [{ id: 7 }], hasNextPage: false })),
      findByID: mock(async () => ({ id: 7, sanity: { asset: { _id: 'image-a-jpg' } }, sync: {} })),
      update,
      delete: remove,
    }

    const result = await handleSanityWebhookEvent({
      payload: payload as never,
      client: client as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: { ids: { deleted: ['image-a-jpg'] }, projectId: 'demo', dataset: 'production' },
      onDeleted: 'delete',
    })

    expect(remove).not.toHaveBeenCalled()
    expect(clientDelete).not.toHaveBeenCalled()
    expect(result.deleted).toBe(0)
    expect(result.ignored).toBe(1)
  })

  test('deletes media when upstream confirms the deleted asset is missing', async () => {
    const remove = mock(async () => ({}))
    const payload = {
      db: postgresDb(),
      find: mock(async () => ({ docs: [{ id: 7 }], hasNextPage: false })),
      findByID: mock(async () => ({
        id: 7,
        sanity: { asset: { _id: 'image-f91b77612953a5e5b5bf9de08c016b9c6844ee0e-800x600-jpg' } },
        sync: {},
      })),
      update: mock(async () => ({})),
      delete: remove,
    }
    const client = { getDocument: mock(async () => undefined) }

    const result = await handleSanityWebhookEvent({
      payload: payload as never,
      client: client as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: {
        ids: { deleted: ['image-f91b77612953a5e5b5bf9de08c016b9c6844ee0e-800x600-jpg'] },
        projectId: 'demo',
        dataset: 'production',
      },
      onDeleted: 'delete',
    })

    expect(remove).toHaveBeenCalledWith({
      collection: 'media',
      id: 7,
      overrideAccess: true,
      req: expect.objectContaining({ transactionID: 'tx-1' }),
    })
    expect(result.deleted).toBe(1)
    expect(result.errors).toBe(0)
  })

  test('ignores webhooks from a different project or dataset', async () => {
    const update = mock(async () => ({}))

    const result = await handleSanityWebhookEvent({
      payload: { update } as never,
      client: {} as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: { ids: { deleted: ['image-a-jpg'] }, projectId: 'other', dataset: 'production' },
      onDeleted: 'mark',
    })

    expect(result).toEqual({ created: 0, deleted: 0, updated: 0, ignored: 0, errors: 0 })
    expect(update).not.toHaveBeenCalled()
  })

  test('syncs updated upstream assets into matching Payload media rows', async () => {
    const update = mock(async () => ({}))
    const find = mock(async () => ({
      docs: [{ id: 12 }],
      hasNextPage: false,
    }))
    const findByID = mock(async () => ({
      id: 12,
      sanity: { asset: { _id: 'image-updated-jpg' } },
      sync: { status: 'available' },
    }))

    const client = {
      getDocument: mock(async () => ({
        _id: 'image-updated-jpg',
        _type: 'sanity.imageAsset',
        assetId: 'updated',
        url: 'https://cdn.sanity.io/images/demo/production/updated.jpg',
        mimeType: 'image/jpeg',
      })),
    }

    const result = await handleSanityWebhookEvent({
      payload: { find, findByID, update } as never,
      client: client as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: { ids: { updated: ['image-updated-jpg'] }, projectId: 'demo', dataset: 'production' },
      onDeleted: 'mark',
    })

    expect(result.updated).toBe(1)
    expect(update).toHaveBeenCalled()
  })

  test('syncs updated upstream assets for UUID media document ids', async () => {
    const uuid = '0babf185-2616-41ab-9fb0-1a7f752f5af8'
    const update = mock(async () => ({}))
    const find = mock(async () => ({
      docs: [{ id: uuid }],
      hasNextPage: false,
    }))
    const findByID = mock(async () => ({
      id: uuid,
      sanity: { asset: { _id: 'image-updated-jpg' } },
      sync: { status: 'available' },
    }))

    const client = {
      getDocument: mock(async () => ({
        _id: 'image-updated-jpg',
        _type: 'sanity.imageAsset',
        assetId: 'updated',
        url: 'https://cdn.sanity.io/images/demo/production/updated.jpg',
        mimeType: 'image/jpeg',
      })),
    }

    const result = await handleSanityWebhookEvent({
      payload: { find, findByID, update } as never,
      client: client as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: { ids: { updated: ['image-updated-jpg'] }, projectId: 'demo', dataset: 'production' },
      onDeleted: 'mark',
    })

    expect(result.updated).toBe(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: uuid, overrideAccess: true })
    )
  })
})
