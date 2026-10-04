import { describe, expect, test } from 'bun:test'
import type { Payload, SanitizedConfig } from 'payload'

import { findMediaUsage } from '../../../src/queries/findMediaUsage.js'

describe('findMediaUsage', () => {
  const config = {
    localization: {
      localeCodes: ['pl', 'en'],
      defaultLocale: 'pl',
    },
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
    globals: [
      {
        slug: 'header',
        label: 'Site Header',
        fields: [{ name: 'logo', type: 'upload', relationTo: 'media', label: 'Site Logo' }],
      },
    ],
    routes: { admin: '/admin' },
  } as unknown as SanitizedConfig

  test('scans published and draft layers by default', async () => {
    const draftFlags: boolean[] = []
    const payload = {
      find: async ({ draft }: { draft?: boolean }) => {
        draftFlags.push(draft === true)
        return { docs: [] }
      },
      findGlobal: async ({ draft }: { draft?: boolean }) => {
        draftFlags.push(draft === true)
        return null
      },
      findVersions: async () => ({ docs: [] }),
      findGlobalVersions: async () => ({ docs: [] }),
    } as unknown as Payload

    await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
    })

    expect(draftFlags).toEqual([false, true, false, true, false, true])
  })

  test('finds published reference when draft no longer references media', async () => {
    const payload = {
      find: async ({ collection, draft }: { collection: string; draft?: boolean }) => {
        if (collection === 'posts' && draft === false) {
          return { docs: [{ id: 101, title: 'Still live' }] }
        }
        return { docs: [] }
      },
      findGlobal: async () => null,
      findVersions: async () => ({ docs: [] }),
      findGlobalVersions: async () => ({ docs: [] }),
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
      stopOnFirstMatch: true,
    })

    expect(usages).toHaveLength(1)
    expect(usages[0]).toMatchObject({
      id: 101,
      title: 'Still live',
      collectionSlug: 'posts',
    })
  })

  test('returns empty array when no collection references the media', async () => {
    const payload = {
      find: async () => ({ docs: [] }),
      findGlobal: async () => null,
      findVersions: async () => ({ docs: [] }),
      findGlobalVersions: async () => ({ docs: [] }),
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
    })
    expect(usages).toEqual([])
  })

  test('finds published live reference when draft cleared the field', async () => {
    const payload = {
      find: async () => ({ docs: [] }),
      findGlobal: async ({ draft }: { draft?: boolean }) => {
        if (draft === false) return { logo: 10 }
        return { logo: null }
      },
      findVersions: async () => ({ docs: [] }),
      findGlobalVersions: async () => ({ docs: [] }),
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
      stopOnFirstMatch: true,
    })

    expect(usages).toHaveLength(1)
    expect(usages[0]).toMatchObject({
      type: 'global',
      collectionSlug: 'header',
      referenceLayer: 'published',
    })
  })

  test('returns entries for matching documents in collections and globals', async () => {
    const payload = {
      find: async ({ collection }: { collection: string }) => {
        if (collection === 'posts') {
          return { docs: [{ id: 101, title: 'Hello World' }] }
        }
        return { docs: [] }
      },
      findGlobal: async ({ slug }: { slug: string }) => {
        if (slug === 'header') {
          return { logo: 10 }
        }
        return null
      },
      findVersions: async () => ({ docs: [] }),
      findGlobalVersions: async () => ({ docs: [] }),
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
    })
    expect(usages).toHaveLength(2)
    expect(
      usages.some(
        (u) =>
          u.type === 'collection' &&
          u.id === 101 &&
          u.referenceLayer === 'published' &&
          u.adminPath === '/admin/collections/posts/101'
      )
    ).toBe(true)
    expect(
      usages.some(
        (u) =>
          u.type === 'global' &&
          u.collectionSlug === 'header' &&
          u.referenceLayer === 'published' &&
          u.adminPath === '/admin/globals/header'
      )
    ).toBe(true)
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
      findGlobal: async () => null,
      findVersions: async () => ({ docs: [] }),
      findGlobalVersions: async () => ({ docs: [] }),
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

  test('returns results sorted by document title', async () => {
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
      findGlobal: async () => null,
      findVersions: async () => ({ docs: [] }),
      findGlobalVersions: async () => ({ docs: [] }),
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
    })
    expect(usages).toHaveLength(3)
    expect(usages.map((u) => u.title).sort()).toEqual(['Apple', 'Bob', 'Zebra'])
  })
})
