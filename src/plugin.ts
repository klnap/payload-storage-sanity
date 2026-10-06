import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { PluginOptions as CloudStoragePluginOptions } from '@payloadcms/plugin-cloud-storage/types'
import type { CollectionConfig, Config, Endpoint, Field, Plugin, UploadConfig } from 'payload'

import { createSanityAdapter } from './adapter/createAdapter'
import { wrapSanityAdapterForUploadRollback } from './adapter/wrapSanityAdapterForUploadRollback'
import {
  MEDIA_UPLOAD_BUSY_SHIELD_IMPORT,
  MEDIA_USAGE_INSPECTOR_IMPORT,
} from './admin/constants'
import { createSanityClient } from './client/createSanityClient'
import {
  collectionHasAltField,
  getLocalizationLocales,
  localizedAltGroupField,
  plainAltTextField,
  resolveCollectionAltOptions,
} from './fields/localizedAltGroup'
import { finalizeSanityMediaCollectionFields } from './fields/mediaFieldLayout'
import { collectTopLevelFieldNames } from './fields/mediaFields'
import { createMediaUsageEndpoint } from './endpoints/mediaUsage'
import { createSanityReconcileEndpoint } from './endpoints/reconcile'
import { createSanityWebhookEndpoint } from './endpoints/webhook'
import {
  createMediaDedupeAfterOperationHook,
  createMediaDedupeBeforeChangeHook,
} from './hooks/dedupeUpload'
import { createMediaDeleteSanityAssetBeforeDeleteHook } from './hooks/deleteSanityAsset'
import { createSanityMediaBulkDeleteBeforeOperationHook } from './hooks/mediaBulkDelete'
import { createSanityMediaDeleteAfterOperationHook } from './hooks/mediaDeleteAfterOperation'
import {
  createSanityMediaAfterReadHook,
  createSanityMediaBeforeChangeHook,
  createSanityMediaEnsureCropSourceUrlBeforeOperationHook,
  createSanityMediaHydrateResponseAfterChangeHook,
  createSanityMediaPersistUpstreamBeforeChangeHook,
} from './hooks/media'
import { createSanityMediaUploadMaxSizeBeforeChangeHook } from './hooks/uploadMaxSize'
import { sanityMediaForceSelect } from './populate/forceSelect'
import { sanityMediaDefaultPopulateSelect } from './populate/mediaDefaultPopulateSelect'
import { presetUsesDefaultPopulate } from './populate/presets'
import { resolvePopulateOptionsForCollection } from './populate/resolvePopulateOptions'
import { createMediaReferenceIntegrityBeforeDeleteHook } from './hooks/mediaReferenceIntegrity'
import { createMediaReplaceSanityAssetAfterChangeHook } from './hooks/replaceSanityAsset'
import { createSanityUploadAfterChangeChain } from './hooks/uploadAfterChangeChain'
import { warnSanityStorageConfig } from './utils/sanityConfig'
import { validateSanityStoragePluginOptions } from './utils/validateSanityStoragePluginOptions'
import { applyPayloadUploadFileSizeLimit, computeMaxUploadByteLimit } from './utils/uploadMaxSize'
import { sanityAdminThumbnail } from './utils/sanityAdminThumbnail'
import { resolveSanitySyncConfig } from './sync/resolveSyncConfig'
import { resolveCollectionAdmin } from './utils/resolveCollectionAdmin'
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

/**
 * Replaces the cloud-storage `afterChange` tail (last hook registered by the plugin)
 * with a chained hook: cloud upload + replace + hydrate, with Sanity rollback on failure.
 */
function replaceCloudStorageAfterChangeWithUploadChain(
  collection: CollectionConfig,
  args: { client: ReturnType<typeof createSanityClient>; cdnBaseUrl?: string }
): CollectionConfig {
  const afterChange = collection.hooks?.afterChange ?? []
  if (afterChange.length === 0) {
    return collection
  }

  const cloudHook = afterChange[afterChange.length - 1]
  if (!cloudHook) {
    return collection
  }

  const userHooks = afterChange.slice(0, -1)
  const chained = createSanityUploadAfterChangeChain({
    client: args.client,
    cloudHook,
    replaceHook: createMediaReplaceSanityAssetAfterChangeHook(args.client),
    hydrateHook: createSanityMediaHydrateResponseAfterChangeHook({ cdnBaseUrl: args.cdnBaseUrl }),
  })

  return {
    ...collection,
    hooks: {
      ...collection.hooks,
      afterChange: [...userHooks, chained],
    },
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
            ? wrapSanityAdapterForUploadRollback(
                createSanityAdapter({ client, cdnBaseUrl, projectId, dataset, token })
              )
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
          const collectionAdmin = resolveCollectionAdmin(pluginAdmin, collOptions)
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

          const userFieldNames = new Set(collectTopLevelFieldNames(collection.fields ?? []))
          const existingFields = nextCollection.fields ?? []
          const altFields: Field[] = []
          const injectedUiFields: Field[] = []

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

          const localizedAltGroup =
            altOptions.enabled &&
            localizationLocales.length > 0 &&
            !collectionHasAltField(existingFields)

          const mediaAfterRead = createSanityMediaAfterReadHook({
            collectionSlug: slug,
            cdnBaseUrl,
            resolvedPreset: populateResolved.preset,
            altFallbackLocale: altOptions.fallbackLocale,
            localPopulate: populateResolved.localPopulate,
            localizedAltGroup,
          })

          const usesDefaultPopulate = presetUsesDefaultPopulate(populateResolved.preset)

          if (collectionAdmin.usageInspector) {
            injectedUiFields.push(mediaUsageField)
          }

          const existingEditComponents = nextCollection.admin?.components?.edit
          const uploadBusyShieldControls = collectionAdmin.uploadBusyShield
            ? [
                ...(existingEditComponents?.beforeDocumentControls ?? []),
                MEDIA_UPLOAD_BUSY_SHIELD_IMPORT,
              ]
            : existingEditComponents?.beforeDocumentControls

          nextCollection = {
            ...nextCollection,
            defaultPopulate: usesDefaultPopulate
              ? sanityMediaDefaultPopulateSelect()
              : undefined,
            forceSelect: sanityMediaForceSelect(populateResolved.preset),
            endpoints: [
              ...collectionEndpoints,
              createMediaUsageEndpoint({ mediaCollectionSlug: slug }),
            ],
            admin: {
              ...nextCollection.admin,
              useAsTitle: nextCollection.admin?.useAsTitle ?? 'id',
              defaultColumns:
                nextCollection.admin?.defaultColumns ??
                ['filename', 'originalFilename', 'id', 'updatedAt'],
              components: {
                ...nextCollection.admin?.components,
                edit: {
                  ...existingEditComponents,
                  ...(uploadBusyShieldControls
                    ? { beforeDocumentControls: uploadBusyShieldControls }
                    : {}),
                },
              },
            },
            fields: finalizeSanityMediaCollectionFields(
              [...existingFields, ...altFields, ...injectedUiFields],
              userFieldNames
            ),
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
                createSanityMediaBulkDeleteBeforeOperationHook(),
                createSanityMediaEnsureCropSourceUrlBeforeOperationHook({ cdnBaseUrl }),
                ...(nextCollection.hooks?.beforeOperation ?? []),
              ],
              beforeChange: [
                createSanityMediaUploadMaxSizeBeforeChangeHook({
                  plugin: pluginUploadMaxSize,
                  collection: collectionUploadMaxSize,
                }),
                createSanityMediaBeforeChangeHook({ localizedAltGroup }),
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
                afterOperation: [
                  ...(nextCollection.hooks?.afterOperation ?? []),
                  createSanityMediaDeleteAfterOperationHook(),
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
          if (storageMode.mode === 'full') {
            nextCollection = replaceCloudStorageAfterChangeWithUploadChain(nextCollection, {
              client,
              cdnBaseUrl,
            })
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
