import { describe, expect, mock, test } from 'bun:test'

import { handleSanityWebhookEvent } from '@/features/asset-sync'

const ASSET = 'image-f91b77612953a5e5b5bf9de08c016b9c6844ee0e-800x600-jpg'
const AVAILABLE_ASSET = {
  _id: ASSET,
  _type: 'sanity.imageAsset',
  assetId: 'f91b77612953a5e5b5bf9de08c016b9c6844ee0e',
  url: 'https://cdn.sanity.io/images/p/d/f91b77612953a5e5b5bf9de08c016b9c6844ee0e-800x600.jpg',
}

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

/**
 * Deterministic interleaving: upstream reports the asset missing on the first read, then a same-bytes
 * upload commits (so the asset exists again) before the lock is taken. The read under the lock must see it.
 */
describe('deleted-event webhook re-checks upstream under the asset lock', () => {
  test('a same-bytes re-upload that lands before the lock keeps the row and the asset', async () => {
    const db = postgresDb()
    const remove = mock(async () => ({}))
    const clientDelete = mock(async () => {})
    let reads = 0
    const client = {
      getDocument: mock(async () => {
        reads += 1
        // read 1 (pre-check): missing. read 2 (under the lock): present again.
        return reads === 1 ? undefined : AVAILABLE_ASSET
      }),
      delete: clientDelete,
    }
    const payload = {
      db,
      find: mock(async () => ({ docs: [{ id: 7 }], hasNextPage: false })),
      findByID: mock(async () => ({ id: 7, sanity: { asset: { _id: ASSET } }, sync: {} })),
      update: mock(async () => ({})),
      delete: remove,
      logger: { warn: mock(() => {}), error: mock(() => {}) },
    }

    const result = await handleSanityWebhookEvent({
      payload: payload as never,
      client: client as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: { ids: { deleted: [ASSET] }, projectId: 'demo', dataset: 'production' },
      onDeleted: 'delete',
    })

    expect(reads).toBe(2)
    expect(remove).not.toHaveBeenCalled()
    expect(clientDelete).not.toHaveBeenCalled()
    expect(db.rollbackTransaction).toHaveBeenCalled()
    expect(db.commitTransaction).not.toHaveBeenCalled()
    expect(result.deleted).toBe(0)
    expect(result.ignored).toBe(1)
  })

  test('an adapter without a transaction lock keeps the asset', async () => {
    const db = { ...postgresDb(), packageName: 'sqlite' }
    const remove = mock(async () => ({}))
    const client = { getDocument: mock(async () => undefined), delete: mock(async () => {}) }
    const payload = {
      db,
      find: mock(async () => ({ docs: [{ id: 7 }], hasNextPage: false })),
      findByID: mock(async () => ({ id: 7 })),
      update: mock(async () => ({})),
      delete: remove,
      logger: { warn: mock(() => {}), error: mock(() => {}) },
    }

    const result = await handleSanityWebhookEvent({
      payload: payload as never,
      client: client as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: { ids: { deleted: [ASSET] }, projectId: 'demo', dataset: 'production' },
      onDeleted: 'delete',
    })

    expect(remove).not.toHaveBeenCalled()
    expect(result.ignored).toBe(1)
  })
})
