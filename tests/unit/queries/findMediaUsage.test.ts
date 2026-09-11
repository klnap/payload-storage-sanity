import { describe, expect, test } from 'bun:test'
import type { Payload, SanitizedConfig } from 'payload'

import { findMediaUsage } from '../../../src/queries/findMediaUsage.js'

describe('findMediaUsage', () => {
  const config = {
    collections: [
      {
        slug: 'media',
        fields: [],
      },
      {
        slug: 'posts',
        labels: { singular: 'Post' },
        admin: { useAsTitle: 'title' },
        fields: [{ name: 'cover', type: 'upload', relationTo: 'media', label: 'Cover' }],
      },
      {
        slug: 'authors',
        labels: { singular: 'Author' },
        admin: { useAsTitle: 'name' },
        fields: [{ name: 'avatar', type: 'upload', relationTo: 'media' }],
      },
    ],
    routes: { admin: '/admin' },
  } as unknown as SanitizedConfig

  test('returns empty array when no collection references the media', async () => {
    const payload = {
      find: async () => ({ docs: [] }),
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
    })
    expect(usages).toEqual([])
  })

  test('returns one entry per matching document with correct shape', async () => {
    const payload = {
      find: async ({ collection }: { collection: string }) => {
        if (collection === 'posts') {
          return { docs: [{ id: 101, title: 'Hello World' }] }
        }
        return { docs: [] }
      },
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
    })
    expect(usages).toHaveLength(1)
    expect(usages[0]).toMatchObject({
      id: 101,
      title: 'Hello World',
      collectionSlug: 'posts',
      collectionLabel: 'Post',
      fieldPath: 'cover',
      fieldLabel: 'Cover',
      adminPath: '/admin/collections/posts/101',
    })
  })

  test('stopOnFirstMatch exits after the first inbound reference', async () => {
    const payload = {
      find: async ({ collection }: { collection: string }) => {
        if (collection === 'posts') {
          return { docs: [{ id: 101, title: 'Hello World' }] }
        }
        if (collection === 'authors') {
          return { docs: [{ id: 201, name: 'Alice' }] }
        }
        return { docs: [] }
      },
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
      stopOnFirstMatch: true,
    })
    expect(usages).toHaveLength(1)
  })

  test('returns results sorted by collection label then title', async () => {
    const payload = {
      find: async ({ collection }: { collection: string }) => {
        if (collection === 'posts') {
          return {
            docs: [
              { id: 102, title: 'Zebra' },
              { id: 101, title: 'Apple' },
            ],
          }
        }
        if (collection === 'authors') {
          return { docs: [{ id: 201, name: 'Bob' }] }
        }
        return { docs: [] }
      },
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
    })
    expect(usages).toHaveLength(3)
    // Author comes before Post alphabetically
    expect(usages[0].collectionLabel).toBe('Author')
    expect(usages[1].collectionLabel).toBe('Post')
    expect(usages[1].title).toBe('Apple')
    expect(usages[2].title).toBe('Zebra')
  })
})
