import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { PluginOptions as CloudStoragePluginOptions } from '@payloadcms/plugin-cloud-storage/types'
import type { Config, Endpoint, Plugin } from 'payload'
import type { SanityStorageCollectionOptions, SanityStoragePluginOptions } from '@/core/config'
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

type SelectedCollections = Record<string, true | SanityStorageCollectionOptions>

function hasUpload(collection: NonNullable<Config['collections']>[number]): boolean {
  return collection.upload === true || (collection.upload != null && collection.upload !== false)
}

function hasStorageAdapter(collection: NonNullable<Config['collections']>[number]): boolean {
  return (
    typeof collection.upload === 'object' &&
    collection.upload !== null &&
    collection.upload.adapter != null
  )
}

function resolveCollections(
  options: SanityStoragePluginOptions,
  config: Config,
  cloudStorageEnabled: boolean
): SelectedCollections {
  const configured = options.collections
  const payloadCollections = config.collections ?? []

  if (configured === undefined) {
    return Object.fromEntries(
      payloadCollections
        .filter((collection) => hasUpload(collection))
        .filter((collection) => !cloudStorageEnabled || !hasStorageAdapter(collection))
        .map(({ slug }) => [slug, true])
    )
  }

  for (const slug of Object.keys(configured)) {
    const collection = payloadCollections.find((entry) => entry.slug === slug)
    if (!collection) {
      throw new Error(
        `payload-storage-sanity: configured collection "${slug}" does not exist in Payload config`
      )
    }
    if (!hasUpload(collection)) {
      throw new Error(
        `payload-storage-sanity: configured collection "${slug}" must have upload enabled`
      )
    }
    if (cloudStorageEnabled && hasStorageAdapter(collection)) {
      throw new Error(
        `payload-storage-sanity: collection "${slug}" already has a storage adapter; refusing to replace it`
      )
    }
  }

  return configured as SelectedCollections
}

export function sanityStorage(options: SanityStorageOptions): Plugin {
  validateSanityStoragePluginOptions(options)

  const {
    projectId,
    dataset,
    token,
    apiVersion,
    resolveFetch,
    cdnBaseUrl,
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

  return (incomingConfig: Config): Config => {
    const collections = resolveCollections(options, incomingConfig, cloudStorageEnabled)
    const configuredMediaSlugs = new Set(Object.keys(collections))
    const firstCollectionSlug = configuredMediaSlugs.values().next().value
    const resolvedSync = resolveSanitySyncConfig(sync, firstCollectionSlug)

    if (configuredMediaSlugs.size === 0 && !resolvedSync.enabled) {
      return incomingConfig
    }

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
                  folder: collOptions === true ? 'Payload' : (collOptions.folder ?? 'Payload'),
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

    for (const slug of configuredMediaSlugs) {
      const collection = incomingConfig.collections?.find((entry) => entry.slug === slug)
      if (!collection || !hasUpload(collection)) {
        throw new Error(
          `payload-storage-sanity: configured collection "${slug}" must exist and have upload enabled`
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
    const resolvedOptions: SanityStoragePluginOptions = { ...options, collections }
    const priorOnInit = config.onInit

    let nextConfig: Config = {
      ...config,
      onInit: async (payload) => {
        if (cloudStorageEnabled) {
          for (const slug of configuredMediaSlugs) {
            const collection = payload.config.collections.find((entry) => entry.slug === slug)
            if (
              !collection ||
              typeof collection.upload !== 'object' ||
              collection.upload.adapter !== 'sanity'
            ) {
              throw new Error(
                `payload-storage-sanity: another storage plugin replaced the adapter for collection "${slug}"; check plugin order`
              )
            }
          }
        }
        await priorOnInit?.(payload)
      },
      admin: {
        ...config.admin,
        components: {
          ...config.admin?.components,
          providers: [
            ...(config.admin?.components?.providers ?? []),
            {
              path: '@klnap/payload-storage-sanity/admin#SanityStorageStyles',
            },
          ],
        },
      },
      i18n: mergeSanityStorageTranslations(config.i18n),
      endpoints: [...(config.endpoints ?? []), ...endpoints],
      collections: (config.collections ?? []).map((collection) =>
        applySanityStorageToMediaCollection(collection, {
          options: resolvedOptions,
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
