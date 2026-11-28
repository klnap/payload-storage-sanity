import { describe, expect, test } from 'bun:test'
import type { SanityStoragePluginOptions } from '@/core/config'
import { validateSanityStoragePluginOptions } from '@/core/config'

describe('validateSanityStoragePluginOptions', () => {
  test('validates per-collection folder paths', () => {
    const base = { projectId: 'p', dataset: 'd', token: 't', collections: { media: true as const } }
    expect(() =>
      validateSanityStoragePluginOptions({
        ...base,
        collections: { media: { folder: '/Payload/Blog/' } },
      })
    ).not.toThrow()
    for (const folder of [
      '',
      ' / / ',
      'media//images',
      'media/../images',
      'media\\images',
      null,
      12,
    ]) {
      expect(() =>
        validateSanityStoragePluginOptions({
          ...base,
          collections: { media: { folder: folder as never } },
        })
      ).toThrow(/folder/)
    }
  })

  test('validates global and category folder settings', () => {
    const base = { projectId: 'p', dataset: 'd', token: 't' }
    expect(() =>
      validateSanityStoragePluginOptions({
        ...base,
        folders: { image: 'Media/images', video: false },
        collections: { media: { folder: { video: 'Media/video', audio: false } } },
      })
    ).not.toThrow()
    expect(() =>
      validateSanityStoragePluginOptions({ ...base, folders: { document: 'Media/docs' } as never })
    ).toThrow(/folders/)
    expect(() =>
      validateSanityStoragePluginOptions({
        ...base,
        collections: { media: { folder: { image: '' } } },
      })
    ).toThrow(/collections\.media\.folder/)
  })

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

  test('validates the versioned HTTP upload transport config', () => {
    const transport = {
      endpoint: 'https://uploads.example.test/v1/upload',
      maxSizeBytes: 50 * 1024 * 1024,
      protocolVersion: 1 as const,
      secret: 'a test secret with at least thirty-two bytes',
    }
    expect(() =>
      validateSanityStoragePluginOptions({
        projectId: 'p',
        dataset: 'd',
        token: 't',
        upload: { transport },
      })
    ).not.toThrow()
    expect(() =>
      validateSanityStoragePluginOptions({
        projectId: 'p',
        dataset: 'd',
        token: 't',
        upload: { transport: { ...transport, endpoint: 'http://uploads.example.test' } },
      })
    ).toThrow(/endpoint/)
    expect(() =>
      validateSanityStoragePluginOptions({
        projectId: 'p',
        dataset: 'd',
        token: 't',
        upload: { transport: { ...transport, protocolVersion: 2 } as never },
      })
    ).toThrow(/protocolVersion/)
    expect(() =>
      validateSanityStoragePluginOptions({
        projectId: 'p',
        dataset: 'd',
        token: 't',
        upload: { transport: { ...transport, secret: 'short' } },
      })
    ).toThrow(/secret/)
  })
})
