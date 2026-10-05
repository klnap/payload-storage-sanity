import { describe, expect, test } from 'bun:test'

import { resolveSanitySyncConfig } from '../../../src/sync/resolveSyncConfig.js'

describe('resolveSanitySyncConfig', () => {
  test('registers webhook and reconcile when sync enabled', () => {
    const resolved = resolveSanitySyncConfig(
      { enabled: true, webhook: { secret: 's' } },
      'media'
    )
    expect(resolved.webhook?.secret).toBe('s')
    expect(resolved.webhook?.path).toBe('/sanity-storage/webhook')
    expect(resolved.reconcile?.path).toBe('/sanity-storage/reconcile')
    expect(resolved.reconcile?.collectionSlug).toBe('media')
  })

  test('basePath and per-route path overrides', () => {
    const resolved = resolveSanitySyncConfig(
      {
        enabled: true,
        basePath: '/custom-sync',
        webhook: { secret: 's', path: '/legacy/webhook' },
        reconcile: { path: '/legacy/reconcile' },
      },
      'media'
    )
    expect(resolved.webhook?.path).toBe('/legacy/webhook')
    expect(resolved.reconcile?.path).toBe('/legacy/reconcile')
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
