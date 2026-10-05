import type { SanityStorageSyncConfig } from '../types/adapter'
import { defaultSanitySyncAccess, type SanitySyncAccessFn } from '../utils/sanitySyncAccess'
import { isSanitySyncEnabled } from './enabled'

export type ResolvedSanitySyncWebhook = {
  secret: string
  path: string
  collectionSlug: string
}

export type ResolvedSanitySyncReconcile = {
  path: string
  collectionSlug: string
}

export type ResolvedSanitySyncConfig = {
  enabled: boolean
  onDeleted: 'mark' | 'delete'
  access: SanitySyncAccessFn
  webhook: ResolvedSanitySyncWebhook | null
  reconcile: ResolvedSanitySyncReconcile | null
}

export const DEFAULT_SANITY_STORAGE_SYNC_BASE_PATH = '/sanity-storage'

export function normalizeSanityStorageSyncBasePath(basePath?: string): string {
  const raw = (basePath ?? DEFAULT_SANITY_STORAGE_SYNC_BASE_PATH).trim()
  if (!raw) {
    return DEFAULT_SANITY_STORAGE_SYNC_BASE_PATH
  }
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`
  return withLeading.replace(/\/+$/, '') || DEFAULT_SANITY_STORAGE_SYNC_BASE_PATH
}

export function syncRoutePath(basePath: string, segment: 'webhook' | 'reconcile'): string {
  const base = normalizeSanityStorageSyncBasePath(basePath)
  return `${base}/${segment}`
}

export function resolveSanitySyncConfig(
  sync: SanityStorageSyncConfig | undefined,
  fallbackCollectionSlug: string | undefined
): ResolvedSanitySyncConfig {
  const enabled = isSanitySyncEnabled(sync)
  const collectionSlug = fallbackCollectionSlug ?? ''
  const basePath = normalizeSanityStorageSyncBasePath(sync?.basePath)

  const onDeleted = sync?.onDeleted ?? 'mark'
  const access = sync?.access ?? defaultSanitySyncAccess

  let webhook: ResolvedSanitySyncWebhook | null = null
  if (enabled && sync?.webhook?.secret) {
    webhook = {
      secret: sync.webhook.secret,
      path: sync.webhook.path ?? syncRoutePath(basePath, 'webhook'),
      collectionSlug: sync.webhook.collection ?? collectionSlug,
    }
  }

  let reconcile: ResolvedSanitySyncReconcile | null = null
  if (enabled && sync?.reconcile !== false) {
    const reconcileConfig = sync?.reconcile === undefined ? {} : sync.reconcile
    reconcile = {
      path: reconcileConfig.path ?? syncRoutePath(basePath, 'reconcile'),
      collectionSlug: reconcileConfig.collection ?? collectionSlug,
    }
  }

  return {
    enabled,
    onDeleted,
    access,
    webhook,
    reconcile,
  }
}
