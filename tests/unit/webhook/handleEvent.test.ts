import { describe, expect, mock, test } from 'bun:test'

import { handleSanityWebhookEvent } from '../../../src/webhook/handleEvent.js'

describe('handleSanityWebhookEvent', () => {
  test('marks deleted image assets as deleted', async () => {
    const update = mock(async () => ({}))
    const findByID = mock(async () => ({ id: 7, sanity_id: 'image-a-jpg', sync: {} }))
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
      find,
      findByID: mock(async () => ({ id: 7 })),
      update,
      delete: mock(async () => {
        throw new Error('delete failed')
      }),
      logger: { error: mock(() => {}) },
    }

    const result = await handleSanityWebhookEvent({
      payload: payload as never,
      client: {} as never,
      collectionSlug: 'media',
      projectId: 'demo',
      dataset: 'production',
      body: { ids: { deleted: ['image-a-jpg'] }, projectId: 'demo', dataset: 'production' },
      onDeleted: 'delete',
    })

    expect(result.deleted).toBe(1)
    expect(result.errors).toBe(1)
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
      sanity_id: 'image-updated-jpg',
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
})
