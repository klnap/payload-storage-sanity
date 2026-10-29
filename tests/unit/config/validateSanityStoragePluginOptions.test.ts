import { describe, expect, test } from 'bun:test'
import type { SanityStoragePluginOptions } from '@/core/config'
import { validateSanityStoragePluginOptions } from '@/core/config'

describe('validateSanityStoragePluginOptions', () => {
  test('requires projectId and dataset', () => {
    expect(() =>
      validateSanityStoragePluginOptions({
        collections: { media: true },
      } as unknown as SanityStoragePluginOptions)
    ).toThrow(/projectId/)
    expect(() =>
      validateSanityStoragePluginOptions({
        projectId: 'p',
        collections: { media: true },
      } as unknown as SanityStoragePluginOptions)
    ).toThrow(/dataset/)
  })

  test('requires token in full mode', () => {
    expect(() =>
      validateSanityStoragePluginOptions({
        projectId: 'p',
        dataset: 'd',
        mode: 'full',
        collections: { media: true },
      })
    ).toThrow(/token/)
  })

  test('requires token when sync enabled', () => {
    expect(() =>
      validateSanityStoragePluginOptions({
        projectId: 'p',
        dataset: 'd',
        mode: 'fields-only',
        sync: { enabled: true, webhook: { secret: 'whsec' } },
        collections: { media: true },
      })
    ).toThrow(/token.*sync\.enabled/)
  })

  test('requires sync.webhook.secret when sync enabled', () => {
    expect(() =>
      validateSanityStoragePluginOptions({
        projectId: 'p',
        dataset: 'd',
        token: 't',
        sync: { enabled: true },
        collections: { media: true },
      })
    ).toThrow(/sync\.webhook\.secret/)
  })

  test('rejects invalid sync.webhook.maxBodySizeBytes', () => {
    const base = {
      projectId: 'p',
      dataset: 'd',
      token: 't',
      sync: { enabled: true, webhook: { secret: 's' } },
      collections: { media: true },
    } as const

    for (const maxBodySizeBytes of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1024']) {
      expect(() =>
        validateSanityStoragePluginOptions({
          ...base,
          sync: {
            ...base.sync,
            webhook: { secret: 's', maxBodySizeBytes: maxBodySizeBytes as never },
          },
        })
      ).toThrow(/maxBodySizeBytes/)
    }
  })

  test('allows a positive integer sync.webhook.maxBodySizeBytes', () => {
    expect(() =>
      validateSanityStoragePluginOptions({
        projectId: 'p',
        dataset: 'd',
        token: 't',
        sync: { enabled: true, webhook: { secret: 's', maxBodySizeBytes: 10 * 1024 * 1024 } },
        collections: { media: true },
      })
    ).not.toThrow()
  })
})
