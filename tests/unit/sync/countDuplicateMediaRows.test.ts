import { describe, expect, mock, test } from 'bun:test'

import { countDuplicateMediaRows } from '../../../src/sync/countDuplicateMediaRows.js'

describe('countDuplicateMediaRows', () => {
  test('counts newer rows that share sanity.id and sha1hash with an older row', async () => {
    const find = mock(async () => ({
      docs: [
        {
          id: 'a',
          createdAt: '2024-01-01T00:00:00.000Z',
          sanity: { id: 'image-x', sha1hash: 'abc' },
        },
        {
          id: 'b',
          createdAt: '2024-02-01T00:00:00.000Z',
          sanity: { id: 'image-x', sha1hash: 'abc' },
        },
        {
          id: 'c',
          createdAt: '2024-03-01T00:00:00.000Z',
          sanity: { id: 'image-x', sha1hash: 'abc' },
        },
        {
          id: 'solo',
          createdAt: '2024-01-01T00:00:00.000Z',
          sanity: { id: 'image-y', sha1hash: 'def' },
        },
      ],
      hasNextPage: false,
    }))

    const count = await countDuplicateMediaRows(
      { find } as never,
      'media'
    )

    expect(count).toBe(2)
  })
})
