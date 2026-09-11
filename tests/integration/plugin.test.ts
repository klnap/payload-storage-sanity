import { describe, expect, test } from 'bun:test'
import type { Config } from 'payload'

import { sanityStorage } from '../../src/plugin.js'

function applyPlugin(collections: Config['collections']): Config {
  const plugin = sanityStorage({
    projectId: 'demo',
    dataset: 'production',
    token: 'token',
    collections: { media: true },
  })

  const incoming = {
    secret: 'test',
    db: {} as Config['db'],
    collections,
  } as Config

  const result = plugin(incoming)
  if (result instanceof Promise) {
    throw new Error('expected sync plugin result')
  }
  return result
}

describe('sanityStorage', () => {
  test('sets disableLocalStorage on configured upload collections', () => {
    const config = applyPlugin([
      { slug: 'media', upload: true, fields: [] },
      { slug: 'pages', fields: [] },
    ])

    const media = config.collections?.find((c) => c.slug === 'media')
    expect(media?.upload).toMatchObject({
      disableLocalStorage: true,
      crop: false,
      focalPoint: false,
    })
    const uploadConfig = media?.upload
    expect((uploadConfig as { imageSizes?: unknown }).imageSizes).toBeUndefined()

    const pages = config.collections?.find((c) => c.slug === 'pages')
    expect(pages?.upload).toBeUndefined()
  })

  test('respects crop and focalPoint from collection upload config', () => {
    const config = applyPlugin([
      {
        slug: 'media',
        upload: { crop: true, focalPoint: true, staticDir: 'media' },
        fields: [],
      },
    ])

    const media = config.collections?.find((c) => c.slug === 'media')
    expect(media?.upload).toMatchObject({
      crop: true,
      focalPoint: true,
    })
  })

  test('respects disableLocalStorage override', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: { disableLocalStorage: false } },
    })

    const result = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: { staticDir: 'media' }, fields: [] }],
    } as Config)

    if (result instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = result.collections?.find((c) => c.slug === 'media')
    expect(media?.upload).toMatchObject({ disableLocalStorage: false })
  })

  test('registers webhook and reconcile endpoints when sync is enabled', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
      sync: {
        enabled: true,
        webhookSecret: 'secret',
      },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const paths = (config.endpoints ?? []).map((endpoint) => endpoint.path)
    expect(paths).toContain('/sanity/webhook')
    expect(paths).toContain('/sanity/reconcile')
  })

  test('does not register sync endpoints when sync is disabled', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
      sync: {
        webhookSecret: 'secret',
      },
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const paths = (config.endpoints ?? []).map((endpoint) => endpoint.path)
    expect(paths).not.toContain('/sanity/webhook')
    expect(paths).not.toContain('/sanity/reconcile')
  })

  test('reference-integrity hook is first in the beforeDelete chain on media collections', async () => {
    const config = applyPlugin([{ slug: 'media', upload: true, fields: [] }])

    const media = config.collections?.find((c) => c.slug === 'media')
    const beforeDeleteHooks = media?.hooks?.beforeDelete ?? []

    // Both the integrity guard and the Sanity asset cleanup hook must be registered.
    expect(beforeDeleteHooks.length).toBeGreaterThanOrEqual(2)

    // The first hook must be the integrity guard: when references exist it throws
    // an APIError before the Sanity cleanup hook runs.
    const req = {
      payload: {
        config: {
          collections: [
            { slug: 'media', fields: [], flattenedFields: [], upload: true },
            {
              slug: 'pages',
              fields: [{ name: 'cover', type: 'upload', relationTo: 'media' }],
              flattenedFields: [],
            },
          ],
          routes: { admin: '/admin', api: '/api' },
          serverURL: 'http://localhost:3000',
        },
        find: async () => ({ docs: [{ id: 1 }], totalDocs: 1 }),
      },
    }

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      beforeDeleteHooks[0]!({ id: 1, req } as any)
    ).rejects.toThrow('Cannot delete')
  })

  test('skips reference-integrity hook when preventDeleteWhenReferenced is false', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
      preventDeleteWhenReferenced: false,
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    const beforeDeleteHooks = media?.hooks?.beforeDelete ?? []

    expect(beforeDeleteHooks.length).toBe(1)
  })

  test('skips reference-integrity hook when collection-level preventDeleteWhenReferenced is false', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: { preventDeleteWhenReferenced: false } },
      preventDeleteWhenReferenced: true,
    })

    const config = plugin({
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
    } as Config)

    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const media = config.collections?.find((c) => c.slug === 'media')
    const beforeDeleteHooks = media?.hooks?.beforeDelete ?? []

    expect(beforeDeleteHooks.length).toBe(1)
  })
});
