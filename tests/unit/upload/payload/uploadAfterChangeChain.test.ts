import { describe, expect, test } from 'bun:test'
import { createSanityUploadAfterChangeChain } from '@/features/media/lifecycle/upload'

const baseArgs = {
  collection: { slug: 'media' },
  context: {},
  data: {},
  doc: { id: 1 },
  operation: 'create' as const,
  previousDoc: {},
  req: { context: {} },
}

describe('createSanityUploadAfterChangeChain', () => {
  test('runs cloud upload then hydrate in order', async () => {
    const order: string[] = []
    const chain = createSanityUploadAfterChangeChain({
      cloudHook: async () => {
        order.push('cloud')
        return { id: 1, filename: 'image-f91b77612953a5e5b5bf9de08c016b9c6844ee0e-800x600-jpg' }
      },
      hydrateHook: async () => {
        order.push('hydrate')
        return { id: 1, url: 'https://cdn.example/a.jpg' }
      },
    })

    const result = await chain(baseArgs as never)

    expect(order).toEqual(['cloud', 'hydrate'])
    expect(result).toMatchObject({ url: 'https://cdn.example/a.jpg' })
  })

  test('propagates cloud upload failures', async () => {
    const chain = createSanityUploadAfterChangeChain({
      cloudHook: async () => {
        throw new Error('metadata update failed')
      },
      hydrateHook: async () => baseArgs.doc,
    })

    await expect(chain(baseArgs as never)).rejects.toThrow('metadata update failed')
  })
})
