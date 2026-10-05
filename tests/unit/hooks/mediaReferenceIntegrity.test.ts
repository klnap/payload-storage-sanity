import { describe, expect, test } from 'bun:test'
import type { CollectionConfig, SanitizedConfig } from 'payload'
import { APIError } from 'payload'

import { MEDIA_REFERENCED_ERROR_CODE } from '../../../src/hooks/mediaDeleteAfterOperation.js'
import { createMediaReferenceIntegrityBeforeDeleteHook } from '../../../src/hooks/mediaReferenceIntegrity.js'
import { SANITY_STORAGE_CONTEXT_KEY } from '../../../src/populate/requestContext.js'

function sanitizedConfig(collections: CollectionConfig[]): SanitizedConfig {
  return {
    collections: collections.map((c) => ({ ...c, flattenedFields: [] })),
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
    context: options?.context ?? {},
    payload: {
      config: resolvedConfig,
      logger: { error: () => undefined },
      find: async ({ collection }: { collection: string }) => {
        const docs = findResults[collection] ?? []
        return { docs, totalDocs: docs.length }
      },
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

  test('uses compact message and error data on bulk delete', async () => {
    const hook = createMediaReferenceIntegrityBeforeDeleteHook('media')
    const req = makeReq(
      { pages: [{ id: 7 }] },
      undefined,
      {
        context: { [SANITY_STORAGE_CONTEXT_KEY]: { bulkDelete: true } },
        mediaDoc: { filename: 'hero.jpg' },
      }
    )

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
