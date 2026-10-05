import { describe, expect, mock, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'
import type { PayloadRequest } from 'payload'

import {
  clearPendingSanityAssets,
  registerPendingSanityAsset,
  rollbackPendingSanityAssets,
  SANITY_UPLOAD_PENDING_ROLLBACK_KEY,
} from '../../../src/utils/uploadRollback.js'

describe('uploadRollback', () => {
  test('registerPendingSanityAsset dedupes ids on the same request', () => {
    const req = { context: {} } as PayloadRequest
    registerPendingSanityAsset(req, 'image-a-jpg')
    registerPendingSanityAsset(req, 'image-a-jpg')
    registerPendingSanityAsset(req, 'image-b-jpg')

    expect(req.context?.[SANITY_UPLOAD_PENDING_ROLLBACK_KEY]).toEqual(['image-a-jpg', 'image-b-jpg'])
  })

  test('rollbackPendingSanityAssets deletes registered ids', async () => {
    const deleted: string[] = []
    const client = {
      delete: mock(async (id: string) => {
        deleted.push(id)
      }),
    } as unknown as SanityClient

    const req = { context: {} } as PayloadRequest
    registerPendingSanityAsset(req, 'image-a-jpg')
    registerPendingSanityAsset(req, 'image-b-jpg')

    await rollbackPendingSanityAssets(client, req)

    expect(deleted).toEqual(['image-a-jpg', 'image-b-jpg'])
  })

  test('clearPendingSanityAssets removes context key', () => {
    const req = { context: {} } as PayloadRequest
    registerPendingSanityAsset(req, 'image-a-jpg')
    clearPendingSanityAssets(req)
    expect(req.context?.[SANITY_UPLOAD_PENDING_ROLLBACK_KEY]).toBeUndefined()
  })
})
