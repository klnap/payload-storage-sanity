import { describe, expect, mock, test } from 'bun:test'
import type { Payload } from 'payload'

import { findAllMediaBySanityAssetId } from '../../../src/queries/findAllMediaBySanityAssetId.js'

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

    expect(matches).toEqual([{ id: 10 }, { id: UUID }])
  })
})
