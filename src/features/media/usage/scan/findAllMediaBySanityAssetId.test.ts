import { describe, expect, mock, test } from 'bun:test'
import type { Payload } from 'payload'

import { findAllMediaBySanityAssetId } from '@/features/media/usage'

const UUID = '0babf185-2616-41ab-9fb0-1a7f752f5af8'

describe('findAllMediaBySanityAssetId', () => {
  test('returns numeric and UUID document ids', async () => {
    const find = mock(async () => ({
      docs: [{ id: 10 }, { id: UUID }, { id: '' }, { id: null }],
      hasNextPage: false,
    }))

    const payload = { find } as unknown as Payload

    const matches = await findAllMediaBySanityAssetId({
      payload,
      collectionSlug: 'media',
      sanityAssetId: 'image-abc-jpg',
    })

    expect(matches).toEqual([
      { id: 10, collectionSlug: 'media' },
      { id: UUID, collectionSlug: 'media' },
    ])
  })

  test('searches every configured media collection and preserves collection identity', async () => {
    const calls: string[] = []
    const payload = {
      find: async ({ collection }: { collection: string }) => {
        calls.push(collection)
        return {
          docs: [{ id: collection === 'media' ? 10 : 10 }],
          hasNextPage: false,
        }
      },
    } as unknown as Payload

    const matches = await findAllMediaBySanityAssetId({
      payload,
      collectionSlug: 'media',
      collectionSlugs: ['media', 'archive'],
      sanityAssetId: 'image-abc-jpg',
    })

    expect(calls).toEqual(['media', 'archive'])
    expect(matches).toEqual([
      { id: 10, collectionSlug: 'media' },
      { id: 10, collectionSlug: 'archive' },
    ])
  })

  test('finds matches after the first page in each collection', async () => {
    const calls: Array<{ collection: string; page: number }> = []
    const payload = {
      find: async ({ collection, page }: { collection: string; page: number }) => {
        calls.push({ collection, page })
        return {
          docs:
            collection === 'archive' && page === 2
              ? [{ id: UUID }]
              : collection === 'media' && page === 1
                ? [{ id: 10 }]
                : [],
          hasNextPage: page === 1,
        }
      },
    } as unknown as Payload

    const matches = await findAllMediaBySanityAssetId({
      payload,
      collectionSlug: 'media',
      collectionSlugs: ['media', 'archive'],
      sanityAssetId: 'image-abc-jpg',
    })

    expect(calls).toEqual([
      { collection: 'media', page: 1 },
      { collection: 'media', page: 2 },
      { collection: 'archive', page: 1 },
      { collection: 'archive', page: 2 },
    ])
    expect(matches).toEqual([
      { id: 10, collectionSlug: 'media' },
      { id: UUID, collectionSlug: 'archive' },
    ])
  })
})
