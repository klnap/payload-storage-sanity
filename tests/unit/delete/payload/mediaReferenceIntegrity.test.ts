import { describe, expect, test } from 'bun:test'
import type { CollectionConfig, SanitizedConfig } from 'payload'
import { APIError } from 'payload'
import {
  createMediaReferenceIntegrityBeforeDeleteHook,
  MEDIA_REFERENCED_ERROR_CODE,
} from '@/features/media/lifecycle/delete'
import { SANITY_STORAGE_CONTEXT_KEY } from '@/features/media/populate'
import { enTestT } from '../../../helpers/enTestT'

function sanitizedConfig(
  collections: CollectionConfig[],
  globals: SanitizedConfig['globals'] = []
): SanitizedConfig {
  return {
    collections: collections.map((c) => ({ ...c, flattenedFields: [] })),
    globals,
    routes: { admin: '/admin', api: '/api' },
    serverURL: 'http://localhost:3000',
  } as unknown as SanitizedConfig
}

function makeReq(
  findResults: Record<string, { id: number | string }[]>,
  config?: SanitizedConfig,
  options?: {
    context?: Record<string, unknown>
    mediaDoc?: { filename?: string; name?: string }
    find?: (collection: string) => Promise<{ docs: { id: number | string }[] }>
    findGlobal?: (slug: string) => Promise<Record<string, unknown> | null>
  }
) {
  const resolvedConfig =
    config ??
    sanitizedConfig([
      { slug: 'media', fields: [], upload: true },
      {
        slug: 'pages',
        fields: [{ name: 'cover', type: 'upload', relationTo: 'media' }],
      },
    ])

  return {
    transactionID: 'tx-reference-test',
    context: options?.context ?? {},
    t: enTestT,
    payload: {
      db: {
        packageName: '@payloadcms/db-postgres',
        sessions: {
          'tx-reference-test': {
            db: {
              execute: async (query: string) =>
                query === 'show transaction_isolation'
                  ? { rows: [{ transaction_isolation: 'read committed' }] }
                  : { rows: [] },
            },
          },
        },
      },
      config: resolvedConfig,
      logger: { error: () => undefined },
      find: async ({ collection }: { collection: string }) => {
        if (options?.find) return options.find(collection)
        const docs = findResults[collection] ?? []
        return { docs, totalDocs: docs.length }
      },
      findGlobal: async ({ slug }: { slug: string }) => options?.findGlobal?.(slug) ?? null,
      findByID: async () => options?.mediaDoc ?? { filename: 'image-test.jpg' },
    },
  } as unknown as Parameters<
    ReturnType<typeof createMediaReferenceIntegrityBeforeDeleteHook>
  >[0]['req']
}

describe('createMediaReferenceIntegrityBeforeDeleteHook', () => {
  test('returns without throwing when the asset has no inbound references', async () => {
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    const req = makeReq({ pages: [] })

    await expect(hook({ id: 1, req } as Parameters<typeof hook>[0])).resolves.toBeUndefined()
  })

  test('throws APIError with status 400 when at least one reference exists', async () => {
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    const req = makeReq({ pages: [{ id: 7 }] })

    let caught: unknown
    try {
      await hook({ id: 1, req } as Parameters<typeof hook>[0])
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(APIError)
    expect((caught as APIError).status).toBe(400)
  })

  test('error message names the referencing collection', async () => {
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    const req = makeReq({ pages: [{ id: 7 }] })

    let caughtMessage = ''
    try {
      await hook({ id: 1, req } as Parameters<typeof hook>[0])
    } catch (err) {
      if (err instanceof Error) caughtMessage = err.message
    }

    expect(caughtMessage).toContain('Cannot delete')
    expect(caughtMessage).toContain('1 document')
  })

  test('allows deletion when all referencing documents have been unlinked', async () => {
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    const req = makeReq({ pages: [] })

    await expect(hook({ id: 1, req } as Parameters<typeof hook>[0])).resolves.toBeUndefined()
  })

  test('blocks deletion and returns a safe unavailable error when a collection lookup fails', async () => {
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    const req = makeReq({}, undefined, {
      find: async () => {
        throw new Error('database connection details')
      },
    })

    let caught: APIError | undefined
    try {
      await hook({ id: 1, req } as Parameters<typeof hook>[0])
    } catch (err) {
      if (err instanceof APIError) caught = err
    }

    expect(caught?.status).toBe(503)
    expect(caught?.message).toBe('Could not verify whether this media asset is still referenced.')
    expect(caught?.message).not.toContain('database connection details')
  })

  test('blocks deletion before scanning when the adapter cannot provide transaction locks', async () => {
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    let findCalls = 0
    const req = makeReq({}, undefined, {
      find: async () => {
        findCalls += 1
        return { docs: [] }
      },
    })
    const payload = req.payload as unknown as { db: { packageName: string } }
    payload.db.packageName = '@payloadcms/db-sqlite'

    await expect(hook({ id: 1, req } as Parameters<typeof hook>[0])).rejects.toMatchObject({
      status: 503,
      message: 'Could not verify whether this media asset is still referenced.',
    })
    expect(findCalls).toBe(0)
  })

  test('blocks deletion when a global lookup fails', async () => {
    const config = sanitizedConfig([{ slug: 'media', fields: [], upload: true }], [
      {
        slug: 'site-header',
        fields: [{ name: 'logo', type: 'upload', relationTo: 'media' }],
      },
    ] as never)
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    const req = makeReq({}, config, {
      findGlobal: async () => {
        throw new Error('global lookup details')
      },
    })

    await expect(hook({ id: 1, req } as Parameters<typeof hook>[0])).rejects.toMatchObject({
      status: 503,
      message: 'Could not verify whether this media asset is still referenced.',
    })
  })

  test('blocks deletion when one lookup fails after another completed', async () => {
    const config = sanitizedConfig([
      { slug: 'media', fields: [], upload: true },
      { slug: 'pages', fields: [{ name: 'cover', type: 'upload', relationTo: 'media' }] },
      { slug: 'authors', fields: [{ name: 'avatar', type: 'upload', relationTo: 'media' }] },
    ])
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    const req = makeReq({}, config, {
      find: async (collection) => {
        if (collection === 'pages') return { docs: [] }
        throw new Error('later lookup failed')
      },
    })

    await expect(hook({ id: 1, req } as Parameters<typeof hook>[0])).rejects.toMatchObject({
      status: 503,
    })
  })

  test('uses compact message and error data on bulk delete', async () => {
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    const req = makeReq({ pages: [{ id: 7 }] }, undefined, {
      context: { [SANITY_STORAGE_CONTEXT_KEY]: { bulkDelete: true } },
      mediaDoc: { filename: 'hero.jpg' },
    })

    let caught: APIError | undefined
    try {
      await hook({ id: 'media-1', req } as Parameters<typeof hook>[0])
    } catch (err) {
      if (err instanceof APIError) caught = err
    }

    expect(caught?.message).toBe('hero.jpg: in use (1 document)')
    expect(caught?.data).toMatchObject({
      code: MEDIA_REFERENCED_ERROR_CODE,
      mediaId: 'media-1',
      referenceCount: 1,
    })
  })
})
