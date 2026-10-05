import { describe, expect, test } from 'bun:test'

import type { SanityStoragePluginOptions } from '../../../src/types/adapter.js'
import { validateSanityStoragePluginOptions } from '../../../src/utils/validateSanityStoragePluginOptions.js'

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
})
