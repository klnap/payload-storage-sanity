import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { PluginOptions as CloudStoragePluginOptions } from '@payloadcms/plugin-cloud-storage/types'
import type { CollectionConfig, Config, Endpoint, Field, Plugin, UploadConfig } from 'payload'

import { createSanityAdapter } from './adapter/createAdapter'
import { MEDIA_USAGE_INSPECTOR_IMPORT } from './admin/constants'
import { createSanityClient } from './client/createSanityClient'
import {
  collectionHasAltField,
  getLocalizationLocales,
  localizedAltGroupField,
  plainAltTextField,
  resolveCollectionAltOptions,
} from './fields/localizedAltGroup'
import { createMediaUsageEndpoint } from './endpoints/mediaUsage'
import { createSanityReconcileEndpoint } from './endpoints/reconcile'
import { createSanityWebhookEndpoint } from './endpoints/webhook'
import {
  createMediaDedupeAfterOperationHook,
  createMediaDedupeBeforeChangeHook,
} from './hooks/dedupeUpload'
import { createMediaDeleteSanityAssetBeforeDeleteHook } from './hooks/deleteSanityAsset'
import {
  createSanityMediaAfterReadHook,
  createSanityMediaBeforeChangeHook,
  createSanityMediaEnsureCropSourceUrlBeforeOperationHook,
  createSanityMediaHydrateResponseAfterChangeHook,
  createSanityMediaPersistUpstreamBeforeChangeHook,
} from './hooks/media'
import { createSanityMediaUploadMaxSizeBeforeChangeHook } from './hooks/uploadMaxSize'
import { sanityMediaForceSelect } from './populate/forceSelect'
import { resolvePopulateOptionsForCollection } from './populate/resolvePopulateOptions'
import { createMediaReferenceIntegrityBeforeDeleteHook } from './hooks/mediaReferenceIntegrity'
import { createMediaReplaceSanityAssetAfterChangeHook } from './hooks/replaceSanityAsset'
import { warnSanityStorageConfig } from './utils/sanityConfig'
import { validateSanityStoragePluginOptions } from './utils/validateSanityStoragePluginOptions'
import { applyPayloadUploadFileSizeLimit, computeMaxUploadByteLimit } from './utils/uploadMaxSize'
import { sanityAdminThumbnail } from './utils/sanityAdminThumbnail'
import { resolveSanitySyncConfig } from './sync/resolveSyncConfig'
import { resolveSanityStorageMode } from './utils/sanityStorageMode'
import type { SanityMediaDocument } from './types/sanityStorageDocument'
import type { SanityStoragePluginOptions } from './types/index'

export type SanityStorageOptions = SanityStoragePluginOptions

function mergeAfterReadHooks(
  collection: CollectionConfig,
  extraHooks: NonNullable<CollectionConfig['hooks']>['afterRead']
): CollectionConfig['hooks'] {
  return {
    ...collection.hooks,
    afterRead: [...(collection.hooks?.afterRead ?? []), ...(extraHooks ?? [])],
  }
}

function mergeBeforeDeleteHooks(
  collection: CollectionConfig,
  extraHooks: NonNullable<CollectionConfig['hooks']>['beforeDelete']
): CollectionConfig['hooks'] {
  return {
    ...collection.hooks,
    beforeDelete: [...(collection.hooks?.beforeDelete ?? []), ...(extraHooks ?? [])],
  }
}

function mergeAfterChangeHooks(
  collection: CollectionConfig,
  extraHooks: NonNullable<CollectionConfig['hooks']>['afterChange']
): CollectionConfig['hooks'] {
  return {
    ...collection.hooks,
    afterChange: [...(collection.hooks?.afterChange ?? []), ...(extraHooks ?? [])],
  }
}

function mergeDedupeHooks(
  collection: CollectionConfig,
  collectionSlug: string
): CollectionConfig['hooks'] {
  return {
    ...collection.hooks,
    beforeChange: [
      ...(collection.hooks?.beforeChange ?? []),
      createMediaDedupeBeforeChangeHook(collectionSlug),
    ],
    afterOperation: [
      ...(collection.hooks?.afterOperation ?? []),
      createMediaDedupeAfterOperationHook(collectionSlug),
    ],
  }
}

function collectionUploadConfig(collection: CollectionConfig): UploadConfig {
  const upload = collection.upload
  if (upload != null && upload !== true && upload !== false) {
    return upload
  }
  return {}
}

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
    dedupeUploads = true,
    preventDeleteWhenReferenced = true,
    sync,
    uploadMaxSize: pluginUploadMaxSize,
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
              // Default to direct CDN URLs: admin fetches assets from Sanity CDN, no Payload proxy
              disablePayloadAccessControl: true,
            }
          : {
              prefix: collOptions.prefix,
              disableLocalStorage: collOptions.disableLocalStorage,
              // Default true: bypass Payload proxy, serve directly from Sanity CDN
              disablePayloadAccessControl: collOptions.disablePayloadAccessControl ?? true,
            }

      return [
        slug,
        {
          ...base,
          adapter: cloudStorageEnabled
            ? createSanityAdapter({ client, cdnBaseUrl, projectId, dataset, token })
            : null,
        },
      ]
    })
  )
  // SAFETY: entries mirror SanityStoragePluginOptions.collections shape for cloud-storage
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
      endpoints: [...(config.endpoints ?? []), ...endpoints],
      collections: (config.collections ?? []).map((collection) => {
        const slug = collection.slug
        let nextCollection: CollectionConfig = collection

        if (configuredMediaSlugs.has(slug) && collection.upload) {
          const collOptions = collections[slug]
          const altOptions = resolveCollectionAltOptions(collOptions)
          const uploadConfig = collectionUploadConfig(collection)
          const populateResolved = resolvePopulateOptionsForCollection(options, slug)

          const collectionEndpoints = Array.isArray(nextCollection.endpoints)
            ? nextCollection.endpoints
            : []

          const upload: UploadConfig = {
            ...uploadConfig,
            disableLocalStorage:
              collections[slug] === true ? true : (collections[slug].disableLocalStorage ?? true),
            crop: uploadConfig.crop ?? false,
            focalPoint: uploadConfig.focalPoint ?? false,
            hideRemoveFile: uploadConfig.hideRemoveFile ?? true,
            displayPreview: uploadConfig.displayPreview ?? true,
            adminThumbnail:
              uploadConfig.adminThumbnail ??
              (({ doc }) =>
                sanityAdminThumbnail(doc as SanityMediaDocument, { cdnBaseUrl })),
          }

          const mediaUsageField: Field = {
            name: 'mediaUsageInspector',
            type: 'ui',
            admin: {
              components: {
                Field: MEDIA_USAGE_INSPECTOR_IMPORT,
              },
            },
          }

          const existingFields = nextCollection.fields ?? []
          const altFields: Field[] = []

          if (altOptions.enabled) {
            if (collectionHasAltField(existingFields)) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(
                  `[@klnap/payload-storage-sanity] collections.${slug}.alt.enabled but the collection already has an "alt" field; skipping alt injection.`
                )
              }
            } else if (localizationLocales.length === 0) {
              altFields.push(
                plainAltTextField({
                  required: altOptions.required,
                })
              )
            } else {
              altFields.push(
                localizedAltGroupField(localizationLocales, {
                  required: altOptions.required,
                })
              )
            }
          }

          const mediaAfterRead = createSanityMediaAfterReadHook({
            collectionSlug: slug,
            cdnBaseUrl,
            resolvedPreset: populateResolved.preset,
            registry: populateResolved.registry,
            altFallbackLocale: altOptions.fallbackLocale,
          })

          nextCollection = {
            ...nextCollection,
            defaultPopulate: undefined,
            forceSelect: sanityMediaForceSelect(
              populateResolved.preset,
              populateResolved.registry
            ),
            endpoints: [
              ...collectionEndpoints,
              createMediaUsageEndpoint({ mediaCollectionSlug: slug }),
            ],
            admin: {
              ...nextCollection.admin,
              useAsTitle: nextCollection.admin?.useAsTitle ?? 'name',
              defaultColumns:
                nextCollection.admin?.defaultColumns ??
                ['filename', 'name', 'id', 'updatedAt'],
            },
            fields: [
              ...existingFields,
              ...altFields,
              mediaUsageField,
            ],
            upload,
            hooks: mergeAfterReadHooks(nextCollection, [mediaAfterRead]),
          }

          const collectionUploadMaxSize =
            collOptions === true ? undefined : collOptions.uploadMaxSize

          nextCollection = {
            ...nextCollection,
            hooks: {
              ...nextCollection.hooks,
              beforeOperation: [
                createSanityMediaEnsureCropSourceUrlBeforeOperationHook({ cdnBaseUrl }),
                ...(nextCollection.hooks?.beforeOperation ?? []),
              ],
              beforeChange: [
                createSanityMediaUploadMaxSizeBeforeChangeHook({
                  plugin: pluginUploadMaxSize,
                  collection: collectionUploadMaxSize,
                }),
                createSanityMediaBeforeChangeHook(),
                ...(nextCollection.hooks?.beforeChange ?? []),
                createSanityMediaPersistUpstreamBeforeChangeHook(),
              ],
            },
          }
        }

        if (
          dedupeUploads &&
          cloudStorageEnabled &&
          configuredMediaSlugs.has(slug) &&
          collection.upload
        ) {
          nextCollection = {
            ...nextCollection,
            hooks: mergeDedupeHooks(nextCollection, slug),
          }
        }

        if (cloudStorageEnabled && configuredMediaSlugs.has(slug) && collection.upload) {
          const collConfig = collections[slug]
          const shouldGuardReferenceIntegrity =
            typeof collConfig === 'object' && collConfig.preventDeleteWhenReferenced !== undefined
              ? collConfig.preventDeleteWhenReferenced
              : preventDeleteWhenReferenced

          // Reference-integrity guard must run first so that a blocked deletion
          // never reaches the Sanity asset cleanup step.
          if (shouldGuardReferenceIntegrity) {
            nextCollection = {
              ...nextCollection,
              hooks: {
                ...nextCollection.hooks,
                beforeDelete: [
                  createMediaReferenceIntegrityBeforeDeleteHook(slug),
                  ...(nextCollection.hooks?.beforeDelete ?? []),
                ],
              },
            }
          }
          nextCollection = {
            ...nextCollection,
            hooks: mergeBeforeDeleteHooks(nextCollection, [
              createMediaDeleteSanityAssetBeforeDeleteHook(client, slug),
            ]),
          }
          nextCollection = {
            ...nextCollection,
            hooks: mergeAfterChangeHooks(nextCollection, [
              createMediaReplaceSanityAssetAfterChangeHook(client),
              createSanityMediaHydrateResponseAfterChangeHook({ cdnBaseUrl }),
            ]),
          }
        }

        return nextCollection
      }),
    }

    if (maxUploadBytes != null) {
      nextConfig = applyPayloadUploadFileSizeLimit(nextConfig, maxUploadBytes)
    }

    return nextConfig
  }
}
