import { describe, expect, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'

import { createMediaReplaceSanityAssetAfterChangeHook } from '../../../src/hooks/replaceSanityAsset.js'

describe('replaceSanityAsset afterChange', () => {
  test('deletes previous Sanity asset when sanity_id changes on update', async () => {
    const deleted: string[] = []
    const client = {
      delete: async (id: string) => {
        deleted.push(id)
      },
    } as unknown as SanityClient

    const hook = createMediaReplaceSanityAssetAfterChangeHook(client)
    const doc = await hook({
      collection: { slug: 'media' } as never,
      context: {},
      data: {},
      doc: { id: 1, sanity_id: 'image-new' },
      operation: 'update',
      previousDoc: { id: 1, sanity_id: 'image-old' },
      req: { context: {} } as never,
    })

    expect(deleted).toEqual(['image-old'])
    expect(doc).toEqual({ id: 1, sanity_id: 'image-new' })
  })

  test('skips delete when asset id is unchanged or missing', async () => {
    const deleted: string[] = []
    const client = {
      delete: async (id: string) => {
        deleted.push(id)
      },
    } as unknown as SanityClient

    const hook = createMediaReplaceSanityAssetAfterChangeHook(client)

    await hook({
      collection: { slug: 'media' } as never,
      context: {},
      data: {},
      doc: { id: 1, sanity_id: 'image-same' },
      operation: 'update',
      previousDoc: { id: 1, sanity_id: 'image-same' },
      req: { context: {} } as never,
    })

    await hook({
      collection: { slug: 'media' } as never,
      context: {},
      data: {},
      doc: { id: 1 },
      operation: 'create',
      previousDoc: undefined,
      req: { context: {} } as never,
    })

    expect(deleted).toEqual([])
  })
})
