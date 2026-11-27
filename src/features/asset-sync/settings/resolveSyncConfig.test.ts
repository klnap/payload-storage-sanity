import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES,
  resolveSanitySyncConfig,
} from '@/features/asset-sync'

describe('resolveSanitySyncConfig', () => {
  test('registers webhook and reconcile when sync enabled', () => {
    const resolved = resolveSanitySyncConfig({ enabled: true, webhook: { secret: 's' } }, 'media')
    expect(resolved.webhook?.secret).toBe('s')
    expect(resolved.webhook?.path).toBe('/sanity-storage/webhook')
    expect(resolved.webhook?.maxBodySizeBytes).toBe(DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES)
    expect(resolved.reconcile?.path).toBe('/sanity-storage/reconcile')
    expect(resolved.reconcile?.collectionSlug).toBe('media')
  })

  test('honors sync.webhook.maxBodySizeBytes', () => {
    const resolved = resolveSanitySyncConfig(
      { enabled: true, webhook: { secret: 's', maxBodySizeBytes: 2_000_000 } },
      'media'
    )
    expect(resolved.webhook?.maxBodySizeBytes).toBe(2_000_000)
  })

  test('basePath and per-route path overrides', () => {
    const resolved = resolveSanitySyncConfig(
      {
        enabled: true,
        basePath: '/custom-sync',
        webhook: { secret: 's', path: '/custom/webhook' },
        reconcile: { path: '/custom/reconcile' },
      },
      'media'
    )
    expect(resolved.webhook?.path).toBe('/custom/webhook')
    expect(resolved.reconcile?.path).toBe('/custom/reconcile')
  })

  test('skips reconcile when reconcile is false', () => {
    const resolved = resolveSanitySyncConfig(
      { enabled: true, webhook: { secret: 's' }, reconcile: false },
      'media'
    )
    expect(resolved.webhook).not.toBeNull()
    expect(resolved.reconcile).toBeNull()
  })

  test('no webhook without secret', () => {
    const resolved = resolveSanitySyncConfig({ enabled: true }, 'media')
    expect(resolved.webhook).toBeNull()
    expect(resolved.reconcile).not.toBeNull()
  })
})

describe('sync base path normalization', () => {
  test('trims trailing slashes in linear time and keeps the route layout', () => {
    const config = resolveSanitySyncConfig(
      {
        enabled: true,
        basePath: `/custom/path${'/'.repeat(5000)}`,
        webhook: { secret: 's' },
      } as never,
      'media'
    )
    expect(config.webhook?.path).toBe('/custom/path/webhook')
    expect(
      resolveSanitySyncConfig(
        { enabled: true, basePath: '///', webhook: { secret: 's' } } as never,
        'media'
      ).webhook?.path
    ).toBe('/sanity-storage/webhook')
  })
})
