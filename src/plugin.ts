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
  applyMediaRelationshipReferenceHooks,
  applyRichTextReferenceHooks,
} from '@/features/media/lifecycle/reference'
import { createSanityAdapter } from '@/features/media/storage-adapter'
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
    resolveFetch,
    cdnBaseUrl,
    folder = 'Payload',
    collections,
    mode: modeOption,
    dedupeUploads = false,
    preventDeleteWhenReferenced = true,
    sync,
    uploadMaxSize: pluginUploadMaxSize,
    admin: pluginAdmin,
  } = options

  const client = createSanityClient({ projectId, dataset, token, apiVersion, resolveFetch })
  const storageMode = resolveSanityStorageMode({ mode: modeOption })
  const { cloudStorageEnabled, alwaysInsertFields } = storageMode

  const firstCollectionSlug = Object.keys(collections)[0]
  const resolvedSync = resolveSanitySyncConfig(sync, firstCollectionSlug)

  // Type generation only needs the schema; uploads cannot run in that process.
  if (cloudStorageEnabled && process.env.PAYLOAD_GENERATING_TYPES !== 'true') {
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
            ? createSanityAdapter({
                client,
                cdnBaseUrl,
                folder,
                projectId,
                dataset,
                token,
                dedupeUploads,
              })
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
  const guardedMediaSlugs = Object.keys(collections).filter((slug) => {
    const collectionOptions = collections[slug]
    return typeof collectionOptions === 'object' &&
      collectionOptions.preventDeleteWhenReferenced !== undefined
      ? collectionOptions.preventDeleteWhenReferenced
      : preventDeleteWhenReferenced
  })
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
    for (const slug of configuredMediaSlugs) {
      const collection = incomingConfig.collections?.find((entry) => entry.slug === slug)
      if (!collection?.upload) {
        throw new Error(
          `payload-storage-sanity: configured upload collection "${slug}" must exist before sanityStorage() and have upload enabled`
        )
      }
      if (collection.endpoints === false) {
        throw new Error(
          `payload-storage-sanity: collection "${slug}" disables endpoints but Sanity media usage requires one`
        )
      }
      if (
        collection.endpoints?.some(
          (endpoint) => endpoint.method.toLowerCase() === 'get' && endpoint.path === '/:id/usage'
        )
      ) {
        throw new Error(
          `payload-storage-sanity: collection endpoint GET /:id/usage conflicts on "${slug}"`
        )
      }
    }
    for (const endpoint of incomingConfig.endpoints ?? []) {
      if (
        endpoints.some(
          (sanityEndpoint) =>
            endpoint.method.toLowerCase() === sanityEndpoint.method.toLowerCase() &&
            endpoint.path === sanityEndpoint.path
        )
      ) {
        throw new Error(
          `payload-storage-sanity: endpoint ${endpoint.method.toUpperCase()} ${endpoint.path} conflicts with a host endpoint`
        )
      }
    }
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
          cdnBaseUrl,
        })
      ),
    }

    // Rich text can embed media, so writes to rich-text hosts take the same lock as the media delete guard.
    nextConfig = applyRichTextReferenceHooks(nextConfig, [...configuredMediaSlugs])
    if (guardedMediaSlugs.length > 0) {
      nextConfig = applyMediaRelationshipReferenceHooks(
        nextConfig,
        guardedMediaSlugs,
        localizationLocales.map(({ code }) => code)
      )
    }

    if (maxUploadBytes != null) {
      nextConfig = applyPayloadUploadFileSizeLimit(nextConfig, maxUploadBytes)
    }

    return nextConfig
  }
}
