import { describe, expect, mock, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'
import type { PayloadRequest } from 'payload'

import { createSanityUploadAfterChangeChain } from '../../../src/hooks/uploadAfterChangeChain.js'
import {
  registerPendingSanityAsset,
  SANITY_UPLOAD_PENDING_ROLLBACK_KEY,
} from '../../../src/utils/uploadRollback.js'

const baseArgs = {
  collection: { slug: 'media' },
  context: {},
  data: {},
  doc: { id: 1 },
  operation: 'create' as const,
  previousDoc: {},
  req: { context: {} } as PayloadRequest,
}

describe('createSanityUploadAfterChangeChain', () => {
  test('runs cloud, replace, and hydrate in order on success', async () => {
    const order: string[] = []
    const chain = createSanityUploadAfterChangeChain({
      client: { delete: mock(async () => undefined) } as unknown as SanityClient,
      cloudHook: async () => {
        order.push('cloud')
        return { id: 1, filename: 'image-a-jpg' }
      },
      replaceHook: async () => {
        order.push('replace')
        return { id: 1, filename: 'image-a-jpg' }
      },
      hydrateHook: async () => {
        order.push('hydrate')
        return { id: 1, url: 'https://cdn.example/a.jpg' }
      },
    })

    registerPendingSanityAsset(baseArgs.req, 'image-a-jpg')
    const result = await chain(baseArgs as never)

    expect(order).toEqual(['cloud', 'replace', 'hydrate'])
    expect(result).toMatchObject({ url: 'https://cdn.example/a.jpg' })
    expect(baseArgs.req.context?.[SANITY_UPLOAD_PENDING_ROLLBACK_KEY]).toBeUndefined()
  })

  test('rolls back pending assets when cloud hook throws', async () => {
    const deleted: string[] = []
    const chain = createSanityUploadAfterChangeChain({
      client: {
        delete: mock(async (id: string) => {
          deleted.push(id)
        }),
      } as unknown as SanityClient,
      cloudHook: async () => {
        throw new Error('metadata update failed')
      },
      replaceHook: async () => baseArgs.doc,
      hydrateHook: async () => baseArgs.doc,
    })

    registerPendingSanityAsset(baseArgs.req, 'image-new-jpg')

    await expect(chain(baseArgs as never)).rejects.toThrow('metadata update failed')
    expect(deleted).toEqual(['image-new-jpg'])
    expect(baseArgs.req.context?.[SANITY_UPLOAD_PENDING_ROLLBACK_KEY]).toBeUndefined()
  })

  test('rolls back when hydrate throws after cloud success', async () => {
    const deleted: string[] = []
    const chain = createSanityUploadAfterChangeChain({
      client: {
        delete: mock(async (id: string) => {
          deleted.push(id)
        }),
      } as unknown as SanityClient,
      cloudHook: async () => baseArgs.doc,
      replaceHook: async () => baseArgs.doc,
      hydrateHook: async () => {
        throw new Error('hydrate failed')
      },
    })

    registerPendingSanityAsset(baseArgs.req, 'image-new-jpg')

    await expect(chain(baseArgs as never)).rejects.toThrow('hydrate failed')
    expect(deleted).toEqual(['image-new-jpg'])
  })
})
