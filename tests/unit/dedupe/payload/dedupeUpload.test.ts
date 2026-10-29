import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'

import {
  createMediaDedupeAfterOperationHook,
  createMediaDedupeBeforeChangeHook,
  MEDIA_DUPLICATE_UPLOAD_ERROR_CODE,
  SANITY_STORAGE_DEDUPE_CONTEXT_KEY,
} from '@/features/media/lifecycle/dedupe'
import { enTestT } from '../../../helpers/enTestT'

describe('media dedupe hooks', () => {
  test('beforeChange stamps sha1hash when bytes are unique', async () => {
    const buffer = Buffer.from('unique-image')

    const req = {
      file: { data: buffer },
      context: {},
      t: enTestT,
      payload: {
        find: async () => ({ docs: [] }),
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

    expect((data?.sanity as { asset?: { sha1hash?: string } })?.asset?.sha1hash).toBeString()
    expect(req.context[SANITY_STORAGE_DEDUPE_CONTEXT_KEY]).toBeUndefined()
  })

  test('beforeChange throws 409 when identical bytes already exist', async () => {
    const buffer = Buffer.from('duplicate-image')
    const existing = { id: 42, sha1hash: 'abc' }

    const req = {
      file: { data: buffer, name: 'dup.jpg' },
      context: {},
      t: enTestT,
      payload: {
        find: async () => ({ docs: [existing] }),
      },
    } as unknown as PayloadRequest

    const hook = createMediaDedupeBeforeChangeHook('media')

    try {
      await hook({
        collection: { slug: 'media' } as never,
        context: req.context,
        data: { filename: 'a.png' },
        operation: 'create',
        originalDoc: undefined,
        req,
      })
      throw new Error('expected APIError')
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      expect((error as APIError).message).toBe('dup.jpg: already in library (ID 42)')
      expect((error as APIError).status).toBe(409)
      expect((error as APIError).data).toMatchObject({
        code: MEDIA_DUPLICATE_UPLOAD_ERROR_CODE,
        existingId: 42,
      })
    }
  })

  test('afterOperation deletes orphan and throws 409 for Sanity id collision', async () => {
    let deletedId: number | null = null
    let deleteContext: {
      skipCloudStorage?: boolean
      localizedDeleteConfirmed?: boolean
    } | null = null

    const req = {
      context: {
        [SANITY_STORAGE_DEDUPE_CONTEXT_KEY]: { existingId: 42 },
      },
      t: enTestT,
      file: { name: 'a.png' },
      payload: {
        delete: async ({
          id,
          context,
        }: {
          id: number
          context?: {
            skipCloudStorage?: boolean
            localizedDeleteConfirmed?: boolean
          }
        }) => {
          deletedId = id
          deleteContext = context ?? null
        },
      },
    } as unknown as PayloadRequest

    const hook = createMediaDedupeAfterOperationHook('media')

    try {
      await hook({
        args: { depth: 0, overrideAccess: true } as never,
        collection: { slug: 'media' } as never,
        operation: 'create',
        overrideAccess: true,
        req,
        result: { id: 99, filename: 'a.png' },
      })
      throw new Error('expected APIError')
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      expect((error as APIError).message).toBe('a.png: already in library (ID 42)')
      expect((error as APIError).status).toBe(409)
      expect((error as APIError).data).toMatchObject({
        code: MEDIA_DUPLICATE_UPLOAD_ERROR_CODE,
        existingId: 42,
      })
    }

    expect(deletedId as number | null).toBe(99)
    expect(deleteContext).toMatchObject({
      skipCloudStorage: true,
      localizedDeleteConfirmed: true,
    })
  })

  test('afterOperation deletes UUID orphan and throws 409', async () => {
    const uuid = '0babf185-2616-41ab-9fb0-1a7f752f5af8'
    const duplicateUuid = '11111111-2222-3333-4444-555555555555'
    let deletedId: string | null = null

    const req = {
      context: {
        [SANITY_STORAGE_DEDUPE_CONTEXT_KEY]: { existingId: uuid },
      },
      t: enTestT,
      file: { name: 'a.png' },
      payload: {
        delete: async ({ id }: { id: string }) => {
          deletedId = id
        },
      },
    } as unknown as PayloadRequest

    const hook = createMediaDedupeAfterOperationHook('media')

    try {
      await hook({
        args: { depth: 0, overrideAccess: true } as never,
        collection: { slug: 'media' } as never,
        operation: 'create',
        overrideAccess: true,
        req,
        result: { id: duplicateUuid, filename: 'a.png' },
      })
      throw new Error('expected APIError')
    } catch (error) {
      expect(error).toBeInstanceOf(APIError)
      expect((error as APIError).message).toBe(`a.png: already in library (ID ${uuid})`)
    }

    expect(deletedId as string | null).toBe(duplicateUuid)
  })
})
