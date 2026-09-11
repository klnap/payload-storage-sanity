import { describe, expect, mock, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'

import { createMediaDeleteSanityAssetBeforeDeleteHook } from '../../../src/hooks/deleteSanityAsset.js'

describe('createMediaDeleteSanityAssetBeforeDeleteHook', () => {
  test('deletes upstream asset when no other media rows reference it', async () => {
    const deleted: string[] = []
    const client = {
      delete: async (id: string) => {
        deleted.push(id)
      },
    } as unknown as SanityClient

    const find = mock(async () => ({
      docs: [{ id: 5 }],
      hasNextPage: false,
    }))

    const findByID = mock(async () => ({
      id: 5,
      sanity_id: 'image-orphan-jpg',
    }))

    const hook = createMediaDeleteSanityAssetBeforeDeleteHook(client, 'media')
    await hook({
      id: 5,
      collection: { slug: 'media' } as never,
      context: {},
      req: { payload: { find, findByID } } as never,
    })

    expect(deleted).toEqual(['image-orphan-jpg'])
  })

  test('skips upstream delete when another media row still references the asset', async () => {
    const deleted: string[] = []
    const client = {
      delete: async (id: string) => {
        deleted.push(id)
      },
    } as unknown as SanityClient

    const find = mock(async () => ({
      docs: [{ id: 5 }, { id: 9 }],
      hasNextPage: false,
    }))

    const findByID = mock(async () => ({
      id: 5,
      sanity_id: 'image-shared-jpg',
    }))

    const hook = createMediaDeleteSanityAssetBeforeDeleteHook(client, 'media')
    await hook({
      id: 5,
      collection: { slug: 'media' } as never,
      context: {},
      req: { payload: { find, findByID } } as never,
    })

    expect(deleted).toEqual([])
  })

  test('no-ops when media row has no sanity_id', async () => {
    const deleted: string[] = []
    const client = {
      delete: async (id: string) => {
        deleted.push(id)
      },
    } as unknown as SanityClient

    const findByID = mock(async () => ({ id: 5 }))

    const hook = createMediaDeleteSanityAssetBeforeDeleteHook(client, 'media')
    await hook({
      id: 5,
      collection: { slug: 'media' } as never,
      context: {},
      req: { payload: { findByID } } as never,
    })

    expect(deleted).toEqual([])
  })

  test('no-ops when skipCloudStorage context flag is set', async () => {
    const client = {
      delete: mock(async () => {}),
    } as unknown as SanityClient

    const findByID = mock(async () => ({ id: 5, sanity_id: 'image-orphan-jpg' }))

    const hook = createMediaDeleteSanityAssetBeforeDeleteHook(client, 'media')
    await hook({
      id: 5,
      collection: { slug: 'media' } as never,
      context: { skipCloudStorage: true },
      req: { context: { skipCloudStorage: true }, payload: { findByID } } as never,
    })

    expect(findByID).not.toHaveBeenCalled()
  })
})
