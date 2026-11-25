import { describe, expect, test } from 'bun:test'

import { createSanityMediaPersistUpstreamBeforeChangeHook } from '@/features/media/document'

describe('createSanityMediaPersistUpstreamBeforeChangeHook', () => {
  test('keeps the stored sanity.asset identity when an update without bytes carries another _id', () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()

    const result = hook({
      data: {
        filename: 'photo.jpg',
        sanity: {
          asset: {
            _id: 'image-attacker-jpg',
            path: 'attacker/path',
            url: 'https://cdn.sanity.io/attacker.jpg',
          },
        },
      },
      operation: 'update',
      originalDoc: {
        id: 3,
        filename: 'photo.jpg',
        sanity: {
          asset: {
            _id: 'image-stored-jpg',
            path: 'stored/path',
            url: 'https://cdn.sanity.io/stored.jpg',
          },
        },
      },
      req: { context: {}, query: {} },
    } as never) as { sanity: { asset: Record<string, unknown> } }

    expect(result.sanity.asset._id).toBe('image-stored-jpg')
    expect(result.sanity.asset.path).toBe('stored/path')
    expect(result.sanity.asset.url).toBe('https://cdn.sanity.io/stored.jpg')
  })

  test('drops a client-supplied sanity.asset._id when the stored row has no asset', () => {
    const hook = createSanityMediaPersistUpstreamBeforeChangeHook()

    const result = hook({
      data: { filename: 'photo.jpg', sanity: { asset: { _id: 'image-attacker-jpg' } } },
      operation: 'update',
      originalDoc: { id: 3, filename: 'photo.jpg' },
      req: { context: {}, query: {} },
    } as never) as { sanity: { asset: Record<string, unknown> } }

    expect(result.sanity.asset._id).toBeNull()
  })
})
