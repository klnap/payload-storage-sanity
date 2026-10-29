import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { PluginOptions as CloudStoragePluginOptions } from '@payloadcms/plugin-cloud-storage/types'
import type { Config, Endpoint, Plugin } from 'payload'
import type { SanityStoragePluginOptions } from '@/core/config'
import {
  applyPayloadUploadFileSizeLimit,
  computeMaxUploadByteLimit,
  resolveSanityStorageMode,
  validateSanityStoragePluginOptions,
  warnSanityStorageConfig,
} from '@/core/config'
import { mergeSanityStorageTranslations } from '@/core/i18n'
import {
  createSanityReconcileEndpoint,
  createSanityWebhookEndpoint,
  resolveSanitySyncConfig,
} from '@/features/asset-sync'
import { getLocalizationLocales } from '@/features/media/fields'
import {
  createSanityAdapter,
  wrapSanityAdapterForUploadRollback,
} from '@/features/media/storage-adapter'
import { createSanityClient } from '@/sanity/client'
import { applySanityStorageToMediaCollection } from './apply-sanity-media-collection'

export type SanityStorageOptions = SanityStoragePluginOptions

export function sanityStorage(options: SanityStorageOptions): Plugin {
  validateSanityStoragePluginOptions(options)

  const {
    projectId,
    dataset,
    token,
    apiVersion,
    cdnBaseUrl,
    collections,
    mode: modeOption,
    dedupeUploads = false,
    preventDeleteWhenReferenced = true,
    sync,
    uploadMaxSize: pluginUploadMaxSize,
    admin: pluginAdmin,
  } = options

  const client = createSanityClient({ projectId, dataset, token, apiVersion })
  const storageMode = resolveSanityStorageMode({ mode: modeOption })
  const { cloudStorageEnabled, alwaysInsertFields } = storageMode

  const firstCollectionSlug = Object.keys(collections)[0]
  const resolvedSync = resolveSanitySyncConfig(sync, firstCollectionSlug)

  if (cloudStorageEnabled) {
    warnSanityStorageConfig({ projectId, dataset, token })
  }

  const collectionsWithAdapter = Object.fromEntries(
    Object.entries(collections).map(([slug, collOptions]) => {
      const base =
        collOptions === true
          ? {
              disablePayloadAccessControl: true,
            }
          : {
              prefix: collOptions.prefix,
              disableLocalStorage: collOptions.disableLocalStorage,
              disablePayloadAccessControl: collOptions.disablePayloadAccessControl ?? true,
            }

      return [
        slug,
        {
          ...base,
          adapter: cloudStorageEnabled
            ? wrapSanityAdapterForUploadRollback(
                createSanityAdapter({
                  client,
                  cdnBaseUrl,
                  projectId,
                  dataset,
                  token,
                  dedupeUploads,
                })
              )
            : null,
        },
      ]
    })
  )
  const cloudCollections = collectionsWithAdapter as CloudStoragePluginOptions['collections']

  const storagePlugin = cloudStoragePlugin({
    enabled: cloudStorageEnabled,
    alwaysInsertFields,
    collections: cloudCollections,
  })

  const configuredMediaSlugs = new Set(Object.keys(collections))
  const endpoints: Endpoint[] = []

  if (resolvedSync.webhook?.collectionSlug) {
    endpoints.push(
      createSanityWebhookEndpoint({
        client,
        collectionSlug: resolvedSync.webhook.collectionSlug,
        webhookSecret: resolvedSync.webhook.secret,
        projectId,
        dataset,
        path: resolvedSync.webhook.path,
        onDeleted: resolvedSync.onDeleted,
      })
    )
  }

  if (resolvedSync.reconcile?.collectionSlug) {
    endpoints.push(
      createSanityReconcileEndpoint({
        client,
        collectionSlug: resolvedSync.reconcile.collectionSlug,
        path: resolvedSync.reconcile.path,
        access: resolvedSync.access,
      })
    )
  }

  return (incomingConfig: Config): Config => {
    const config = storagePlugin(incomingConfig)
    const localizationLocales = getLocalizationLocales(config)

    const maxUploadBytes = computeMaxUploadByteLimit(pluginUploadMaxSize, collections)

    let nextConfig: Config = {
      ...config,
      i18n: mergeSanityStorageTranslations(config.i18n),
      endpoints: [...(config.endpoints ?? []), ...endpoints],
      collections: (config.collections ?? []).map((collection) =>
        applySanityStorageToMediaCollection(collection, {
          options,
          collections,
          configuredMediaSlugs,
          localizationLocales,
          pluginAdmin,
          pluginUploadMaxSize,
          dedupeUploads,
          preventDeleteWhenReferenced,
          cloudStorageEnabled,
          storageMode,
          client,
          cdnBaseUrl,
        })
      ),
    }

    if (maxUploadBytes != null) {
      nextConfig = applyPayloadUploadFileSizeLimit(nextConfig, maxUploadBytes)
    }

    return nextConfig
  }
}
