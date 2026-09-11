import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'

import {
  createMediaDedupeAfterOperationHook,
  createMediaDedupeBeforeChangeHook,
  SANITY_STORAGE_DEDUPE_CONTEXT_KEY,
} from '../../../src/hooks/dedupeUpload.js'

describe('media dedupe hooks', () => {
  test('beforeChange sets contentHash and dedupe context for duplicate bytes', async () => {
    const buffer = Buffer.from('duplicate-image')
    const existing = { id: 42, sha1hash: 'abc' }

    const req = {
      file: { data: buffer },
      context: {},
      payload: {
        find: async () => ({ docs: [existing] }),
      },
    } as unknown as PayloadRequest

    const hook = createMediaDedupeBeforeChangeHook('media')
    const data = await hook({
      collection: { slug: 'media' } as never,
      context: req.context,
      data: { filename: 'a.png' },
      operation: 'create',
      originalDoc: undefined,
      req,
    })

    expect(data?.sha1hash).toBeString()
    expect(req.context[SANITY_STORAGE_DEDUPE_CONTEXT_KEY]).toEqual({ existingId: 42 })
    expect(req.context.skipCloudStorage).toBe(true)
  })

  test('afterOperation deletes duplicate row and returns existing media', async () => {
    const existingDoc = { id: 42, url: 'https://cdn.example/a.png' }
    let deletedId: number | null = null

    const req = {
      context: {
        [SANITY_STORAGE_DEDUPE_CONTEXT_KEY]: { existingId: 42 },
      },
      payload: {
        delete: async ({ id }: { id: number }) => {
          deletedId = id
        },
        findByID: async () => existingDoc,
      },
    } as unknown as PayloadRequest

    const hook = createMediaDedupeAfterOperationHook('media')
    const result = await hook({
      args: { depth: 0, overrideAccess: true } as never,
      collection: { slug: 'media' } as never,
      operation: 'create',
      overrideAccess: true,
      req,
      result: { id: 99, filename: 'a.png' },
    })

    expect(deletedId as number | null).toBe(99)
    expect(result).toEqual(existingDoc)
  })
})
