import { describe, expect, test } from 'bun:test'
import { applyMediaRelationshipReferenceHooks } from './mediaRelationshipReferenceWriteHook'

const config = {
  collections: [
    { slug: 'media', fields: [] },
    {
      slug: 'articles',
      fields: [
        { name: 'hero', type: 'relationship', relationTo: 'media' },
        { name: 'localizedHero', type: 'relationship', relationTo: 'media', localized: true },
        { name: 'related', type: 'relationship', relationTo: ['pages', 'media'], hasMany: true },
        {
          name: 'blocks',
          type: 'array',
          fields: [{ name: 'attachment', type: 'upload', relationTo: 'media' }],
        },
      ],
    },
  ],
  globals: [{ slug: 'settings', fields: [{ name: 'logo', type: 'upload', relationTo: 'media' }] }],
  localization: { locales: [{ code: 'en' }, { code: 'fr' }] },
} as never

describe('applyMediaRelationshipReferenceHooks', () => {
  test('guards direct, polymorphic, nested-array, localized, and global references', async () => {
    const result = applyMediaRelationshipReferenceHooks(config, ['media'], ['en', 'fr'])
    const collectionHook = (result.collections as never[])[1] as {
      hooks: { beforeChange: Array<(args: never) => Promise<unknown>> }
    }
    const globalHook = (result.globals as never[])[0] as {
      hooks: { beforeChange: Array<(args: never) => Promise<unknown>> }
    }
    const checked: string[] = []
    const req = {
      payload: {
        db: { packageName: '@payloadcms/db-sqlite' },
        findByID: async ({ id }: { id: string }) => {
          checked.push(id)
          return { id }
        },
      },
    }

    await collectionHook.hooks.beforeChange[0]?.({
      data: {
        hero: { id: 'media-1' },
        related: [
          { relationTo: 'pages', value: 'page-1' },
          { relationTo: 'media', value: 'media-2' },
        ],
        blocks: [{ attachment: 'media-3' }],
        localizedHero: { en: 'media-4', fr: null },
      },
      req,
    } as never)
    await globalHook.hooks.beforeChange[0]?.({
      data: { logo: 'media-5' },
      req,
    } as never)

    expect(checked).toEqual(['media-1', 'media-2', 'media-3', 'media-4', 'media-5'])
  })

  test('refuses a reference whose media row is missing', async () => {
    const result = applyMediaRelationshipReferenceHooks(config, ['media'], ['en', 'fr'])
    const collection = (result.collections as never[])[1] as {
      hooks: { beforeChange: Array<(args: never) => Promise<unknown>> }
    }
    const req = {
      payload: {
        db: { packageName: '@payloadcms/db-sqlite' },
        findByID: async () => null,
      },
    }

    await expect(
      collection.hooks.beforeChange[0]?.({
        data: { hero: 'deleted-media-id' },
        req,
      } as never)
    ).rejects.toThrow('field is invalid')
  })

  test('allows clearing an optional relationship', async () => {
    const result = applyMediaRelationshipReferenceHooks(config, ['media'], ['en', 'fr'])
    const collection = (result.collections as never[])[1] as {
      hooks: { beforeChange: Array<(args: never) => Promise<unknown>> }
    }
    const req = {
      payload: {
        db: { packageName: '@payloadcms/db-sqlite' },
        findByID: async () => {
          throw new Error('An empty relationship must not be looked up')
        },
      },
    }

    await expect(
      collection.hooks.beforeChange[0]?.({
        data: { hero: '' },
        req,
      } as never)
    ).resolves.toEqual({ hero: '' })
  })
})
