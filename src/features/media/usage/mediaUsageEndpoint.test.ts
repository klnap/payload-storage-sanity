import { describe, expect, mock, test } from 'bun:test'

import { createMediaUsageEndpoint } from '@/features/media/usage'

describe('createMediaUsageEndpoint', () => {
  test('rejects unauthenticated callers', async () => {
    const endpoint = createMediaUsageEndpoint({ mediaCollectionSlug: 'media' })
    const response = await endpoint.handler({
      routeParams: { id: '1' },
      payload: { config: { admin: { user: 'users' } } },
      t: (key: string) => key,
    } as never)

    expect(response.status).toBe(401)
  })

  test('rejects authenticated non-admin users', async () => {
    const endpoint = createMediaUsageEndpoint({ mediaCollectionSlug: 'media' })
    const response = await endpoint.handler({
      routeParams: { id: '1' },
      user: { id: 'c1', collection: 'customers' },
      payload: { config: { admin: { user: 'users' } } },
      t: (key: string) => key,
    } as never)

    expect(response.status).toBe(401)
  })

  test('allows admin auth collection users to reach findByID gate', async () => {
    const findByID = mock(async () => ({ id: 1 }))
    const endpoint = createMediaUsageEndpoint({ mediaCollectionSlug: 'media' })

    const response = await endpoint.handler({
      routeParams: { id: '1' },
      user: { id: 'u1', collection: 'users' },
      payload: {
        config: { admin: { user: 'users' }, collections: [] },
        findByID,
      },
      t: (key: string) => key,
    } as never)

    expect(response.status).not.toBe(401)
    expect(findByID).toHaveBeenCalled()
  })
})
