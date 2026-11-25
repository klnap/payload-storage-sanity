import { describe, expect, test } from 'bun:test'

import { createSanityClient } from '@/sanity/client/createSanityClient'

describe('createSanityClient', () => {
  test('reuses clients only for matching projects, datasets, API versions, and tokens', () => {
    const projectId = `qualification-${crypto.randomUUID()}`
    const config = {
      projectId,
      dataset: 'qualification',
      apiVersion: '2026-01-01',
      token: 'qualification-token',
    }
    const client = createSanityClient(config)

    expect(createSanityClient(config)).toBe(client)
    expect(createSanityClient({ ...config, projectId: `${projectId}-other` })).not.toBe(client)
    expect(createSanityClient({ ...config, dataset: 'other' })).not.toBe(client)
    expect(createSanityClient({ ...config, apiVersion: '2025-01-01' })).not.toBe(client)
    expect(createSanityClient({ ...config, token: 'rotated-token' })).not.toBe(client)
    expect(client.config()).toMatchObject({
      projectId,
      dataset: 'qualification',
      apiVersion: '2026-01-01',
      token: 'qualification-token',
      useCdn: false,
    })
  })

  test('keeps cached clients isolated by token', () => {
    const projectId = `qualification-${crypto.randomUUID()}`
    const config = { projectId, dataset: 'qualification' }

    const first = createSanityClient({ ...config, token: 'dummy-token-first' })
    const second = createSanityClient({ ...config, token: 'dummy-token-second' })

    expect(first).not.toBe(second)
    expect(first.config().token).toBe('dummy-token-first')
    expect(second.config().token).toBe('dummy-token-second')
    expect(createSanityClient({ ...config, token: 'dummy-token-first' })).toBe(first)
  })
})
