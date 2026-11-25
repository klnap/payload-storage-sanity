import { describe, expect, test } from 'bun:test'
import type { Payload, SanitizedConfig } from 'payload'

import { findMediaUsage } from '@/features/media/usage'

describe('findMediaUsage', () => {
  test('paginates a large bounded relationship result set', async () => {
    const largeConfig = {
      localization: false,
      collections: [
        { slug: 'media', fields: [] },
        {
          slug: 'posts',
          labels: { singular: 'Post' },
          admin: { useAsTitle: 'title' },
          fields: [{ name: 'cover', type: 'relationship', relationTo: 'media' }],
        },
      ],
      globals: [],
      routes: { admin: '/admin' },
    } as unknown as SanitizedConfig
    const records = Array.from({ length: 1_250 }, (_, index) => ({
      id: `post-${index}`,
      title: `Post ${index}`,
    }))
    const pages: number[] = []
    const payload = {
      find: async ({ page, limit }: { page: number; limit: number }) => {
        pages.push(page)
        const start = (page - 1) * limit
        const docs = records.slice(start, start + limit)
        return {
          docs,
          hasNextPage: start + limit < records.length,
        }
      },
      findGlobal: async () => null,
    } as unknown as Payload

    const usages = await findMediaUsage({
      config: largeConfig,
      mediaCollectionSlug: 'media',
      mediaId: 'asset-1',
      payload,
      includePublishedAndDraft: false,
    })

    expect(usages).toHaveLength(records.length)
    expect(pages).toEqual(Array.from({ length: 25 }, (_, index) => index + 1))
  })

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

  test('queries polymorphic references by both value and collection slug', async () => {
    const polymorphicConfig = {
      localization: { localeCodes: ['en'], defaultLocale: 'en' },
      collections: [
        { slug: 'media', fields: [] },
        {
          slug: 'content',
          fields: [
            { name: 'asset', type: 'relationship', relationTo: ['media', 'documents'] },
            {
              name: 'assets',
              type: 'relationship',
              relationTo: ['media', 'documents'],
              hasMany: true,
            },
          ],
        },
      ],
      globals: [],
      routes: { admin: '/admin' },
    } as unknown as SanitizedConfig
    const whereClauses: unknown[] = []
    const payload = {
      find: async ({ where }: { where: unknown }) => {
        whereClauses.push(where)
        return { docs: [], hasNextPage: false }
      },
      findGlobal: async () => null,
    } as unknown as Payload

    await findMediaUsage({
      config: polymorphicConfig,
      mediaCollectionSlug: 'media',
      mediaId: 'media-id',
      payload,
      includePublishedAndDraft: false,
    })

    expect(whereClauses).toEqual([
      {
        and: [
          { 'asset.value': { equals: 'media-id' } },
          { 'asset.relationTo': { equals: 'media' } },
        ],
      },
      {
        and: [
          { 'assets.value': { in: ['media-id'] } },
          { 'assets.relationTo': { equals: 'media' } },
        ],
      },
    ])
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

  test('propagates collection lookup failures instead of reporting no references', async () => {
    const payload = {
      find: async () => {
        throw new Error('collection lookup failed')
      },
      findGlobal: async () => null,
    } as unknown as Payload

    await expect(
      findMediaUsage({ config, mediaCollectionSlug: 'media', mediaId: 10, payload })
    ).rejects.toThrow('collection lookup failed')
  })

  test('propagates global lookup failures instead of reporting no references', async () => {
    const payload = {
      find: async () => ({ docs: [], hasNextPage: false }),
      findGlobal: async () => {
        throw new Error('global lookup failed')
      },
    } as unknown as Payload

    await expect(
      findMediaUsage({ config, mediaCollectionSlug: 'media', mediaId: 10, payload })
    ).rejects.toThrow('global lookup failed')
  })

  test('fails the scan when a later target fails after an earlier target succeeds', async () => {
    const payload = {
      find: async ({ collection }: { collection: string }) => {
        if (collection === 'posts') return { docs: [], hasNextPage: false }
        throw new Error('later collection lookup failed')
      },
      findGlobal: async () => null,
    } as unknown as Payload

    await expect(
      findMediaUsage({ config, mediaCollectionSlug: 'media', mediaId: 10, payload })
    ).rejects.toThrow('later collection lookup failed')
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

  test('paginates collection matches so usage results are complete', async () => {
    const pages: number[] = []
    const payload = {
      find: async ({
        collection,
        draft,
        page,
      }: {
        collection: string
        draft?: boolean
        page?: number
      }) => {
        if (collection !== 'posts' || draft || page == null) {
          return { docs: [], hasNextPage: false }
        }
        pages.push(page)
        if (page === 1) {
          return {
            docs: [
              { id: 101, title: 'Alpha' },
              { id: 102, title: 'Bravo' },
            ],
            hasNextPage: true,
          }
        }
        return { docs: [{ id: 103, title: 'Charlie' }], hasNextPage: false }
      },
      findGlobal: async () => null,
    } as unknown as Payload

    const usages = await findMediaUsage({
      config,
      mediaCollectionSlug: 'media',
      mediaId: 10,
      payload,
      limitPerField: 2,
    })

    expect(pages).toEqual([1, 2])
    expect(usages.map((usage) => usage.id)).toEqual([101, 102, 103])
  })

  test('fails visibly instead of retaining an unbounded editor result set', async () => {
    const payload = {
      find: async ({ collection, page }: { collection: string; page?: number }) => {
        if (collection !== 'posts' || page == null) {
          return { docs: [], hasNextPage: false }
        }
        const firstId = (page - 1) * 50
        const remaining = 10_001 - firstId
        const count = Math.min(50, remaining)
        return {
          docs: Array.from({ length: count }, (_, index) => ({
            id: firstId + index,
            title: `Post ${firstId + index}`,
          })),
          hasNextPage: firstId + count < 10_001,
        }
      },
      findGlobal: async () => null,
    } as unknown as Payload

    await expect(
      findMediaUsage({
        config,
        mediaCollectionSlug: 'media',
        mediaId: 10,
        payload,
        includePublishedAndDraft: false,
      })
    ).rejects.toThrow('Media usage scan exceeded the supported result limit')
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

describe('findMediaUsage respects the requester permissions', () => {
  const config = {
    localization: { localeCodes: ['en'], defaultLocale: 'en' },
    collections: [
      { slug: 'media', fields: [] },
      {
        slug: 'posts',
        labels: { singular: 'Post' },
        admin: { useAsTitle: 'title' },
        fields: [{ name: 'cover', type: 'upload', relationTo: 'media', label: 'Cover' }],
      },
    ],
    globals: [],
    routes: { admin: '/admin' },
  } as unknown as SanitizedConfig

  test('defaults to a privileged scan (integrity callers must see every reference)', async () => {
    const flags: Array<boolean | undefined> = []
    const payload = {
      find: async (args: { overrideAccess?: boolean }) => {
        flags.push(args.overrideAccess)
        return { docs: [] }
      },
      findGlobal: async () => null,
      findVersions: async () => ({ docs: [] }),
      findGlobalVersions: async () => ({ docs: [] }),
    } as unknown as Payload

    await findMediaUsage({ config, mediaCollectionSlug: 'media', mediaId: 10, payload })

    expect(flags.length).toBeGreaterThan(0)
    expect(flags.every((flag) => flag === true)).toBe(true)
  })

  test('requester mode does not bypass access (overrideAccess false, req forwarded)', async () => {
    const calls: Array<{ kind: string; overrideAccess?: boolean; req?: unknown }> = []
    const req = { user: { id: 'editor-1', collection: 'users' } }
    const payload = {
      find: async (args: { overrideAccess?: boolean; req?: unknown }) => {
        calls.push({ kind: 'find', overrideAccess: args.overrideAccess, req: args.req })
        return { docs: [] }
      },
      findGlobal: async (args: { overrideAccess?: boolean; req?: unknown }) => {
        calls.push({ kind: 'findGlobal', overrideAccess: args.overrideAccess, req: args.req })
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
      req: req as never,
      overrideAccess: false,
    })

    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call.overrideAccess).toBe(false)
      expect(call.req).toBe(req)
    }
  })
})
