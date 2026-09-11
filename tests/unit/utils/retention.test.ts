import { describe, expect, mock, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'
import type { Payload } from 'payload'

import {
  deleteReplacedSanityAsset,
  deleteSanityAsset,
  deleteSanityAssetIfUnreferenced,
} from '../../../src/utils/retention.js'

describe('deleteSanityAsset', () => {
  test('deletes asset when id is valid', async () => {
    const deleted: string[] = []
    const client = {
      delete: async (id: string) => {
        deleted.push(id)
      },
    } as unknown as SanityClient

    await deleteSanityAsset(client, 'image-123')
    expect(deleted).toEqual(['image-123'])
  })

  test('no-ops when id is empty', async () => {
    const client = { delete: mock(async () => {}) } as unknown as SanityClient
    await deleteSanityAsset(client, '')
    expect(client.delete).not.toHaveBeenCalled()
  })
})

describe('deleteSanityAssetIfUnreferenced', () => {
  test('deletes asset when only the excluded media row references it', async () => {
    const deleted: string[] = []
    const client = {
      delete: async (id: string) => {
        deleted.push(id)
      },
    } as unknown as SanityClient

    const payload = {
      find: async () => ({ docs: [{ id: 10 }], hasNextPage: false }),
    } as unknown as Payload

    const result = await deleteSanityAssetIfUnreferenced({
      client,
      payload,
      collectionSlug: 'media',
      sanityAssetId: 'image-123',
      excludingMediaId: 10,
    })

    expect(result).toBe(true)
    expect(deleted).toEqual(['image-123'])
  })

  test('keeps asset when other media rows reference it', async () => {
    const deleted: string[] = []
    const client = {
      delete: async (id: string) => {
        deleted.push(id)
      },
    } as unknown as SanityClient

    const payload = {
      find: async () => ({ docs: [{ id: 10 }, { id: 20 }], hasNextPage: false }),
    } as unknown as Payload

    const result = await deleteSanityAssetIfUnreferenced({
      client,
      payload,
      collectionSlug: 'media',
      sanityAssetId: 'image-123',
      excludingMediaId: 10,
    })

    expect(result).toBe(false)
    expect(deleted).toHaveLength(0)
  })
})

describe('deleteReplacedSanityAsset', () => {
  test('does nothing when asset IDs are identical', async () => {
    const client = { delete: mock(async () => {}) } as unknown as SanityClient
    await deleteReplacedSanityAsset(client, 'image-1', 'image-1')
    expect(client.delete).not.toHaveBeenCalled()
  })
})
