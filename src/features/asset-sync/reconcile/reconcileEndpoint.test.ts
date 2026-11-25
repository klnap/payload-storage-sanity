import { describe, expect, mock, test } from 'bun:test'

import { createSanityReconcileEndpoint } from '@/features/asset-sync'

describe('createSanityReconcileEndpoint', () => {
  for (const body of ['{', '{"dryRun":"false"}', '{"limit":0}']) {
    test(`rejects invalid body ${body} without running reconciliation`, async () => {
      const find = mock(async () => ({ docs: [], hasNextPage: false }))
      const endpoint = createSanityReconcileEndpoint({
        client: {} as never,
        collectionSlug: 'media',
        access: () => true,
        canUpdateMedia: async () => true,
      })

      const response = await endpoint.handler({
        headers: new Headers(),
        text: async () => body,
        payload: {
          config: { collections: [] },
          find,
        },
        t: (key: string) => key,
      } as never)

      expect(response.status).toBe(400)
      expect(find).not.toHaveBeenCalled()
    })
  }

  test('rejects a body over the 16 KiB cap before reading it', async () => {
    const find = mock(async () => ({ docs: [], hasNextPage: false }))
    const text = mock(async () => '{}')
    const endpoint = createSanityReconcileEndpoint({
      client: {} as never,
      collectionSlug: 'media',
      access: () => true,
      canUpdateMedia: async () => true,
    })

    const response = await endpoint.handler({
      headers: new Headers({ 'content-length': String(64 * 1024) }),
      text,
      payload: { config: { collections: [] }, find },
      t: (key: string) => key,
    } as never)

    expect(response.status).toBe(413)
    expect(text).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })

  test('returns 429 with Retry-After for a reconcile within the cooldown of a successful one', async () => {
    const find = mock(async () => ({ docs: [], hasNextPage: false }))
    const endpoint = createSanityReconcileEndpoint({
      client: {} as never,
      collectionSlug: 'media',
      access: () => true,
      canUpdateMedia: async () => true,
    })
    const request = {
      headers: new Headers(),
      text: async () => '',
      payload: { config: { collections: [] }, find },
      t: (key: string) => key,
    } as never

    const first = await endpoint.handler(request)
    expect(first.status).toBe(200)

    const second = await endpoint.handler(request)
    expect(second.status).toBe(429)
    const retryAfter = Number(second.headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(60)
    expect(find).toHaveBeenCalledTimes(1)
  })
})
