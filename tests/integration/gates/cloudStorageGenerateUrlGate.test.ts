import { describe, expect, test } from 'bun:test'
import type { CollectionConfig } from 'payload'

import { createSanityAdapter } from '@/features/media/storage-adapter'

const collection = { slug: 'media', fields: [] } as CollectionConfig

describe('cloudStorageGenerateUrlGate', () => {
  test('generateURL uses path + cdnBaseUrl', () => {
    const adapter = createSanityAdapter({
      client: { projectId: 'demo', dataset: 'production' } as never,
      cdnBaseUrl: 'https://cdn.example.com',
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
    })({ collection })

    const url = adapter.generateURL?.({
      collection,
      data: {
        sync: { status: 'available' },
        sanity: {
          asset: {
            _id: 'image-abc123-800x600-jpg',
            path: 'images/demo/production/abc123-800x600.jpg',
          },
        },
      },
      filename: 'abc123-800x600.jpg',
    } as never)

    expect(url).toBe('https://cdn.example.com/images/demo/production/abc123-800x600.jpg')
  })

  test('generateURL returns empty string when only sanity.asset._id is present', () => {
    const adapter = createSanityAdapter({
      client: { projectId: 'demo', dataset: 'production' } as never,
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
    })({ collection })

    const url = adapter.generateURL?.({
      collection,
      data: {
        sync: { status: 'available' },
        sanity: { asset: { _id: 'image-abc123-800x600-jpg' } },
      },
      filename: 'ignored',
    } as never)

    expect(url).toBe('')
  })
})
