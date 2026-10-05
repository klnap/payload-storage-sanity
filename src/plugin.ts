import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { PluginOptions as CloudStoragePluginOptions } from '@payloadcms/plugin-cloud-storage/types'
import type { CollectionConfig, Config, Endpoint, Field, Plugin, UploadConfig } from 'payload'

import { createSanityAdapter } from './adapter/createAdapter'
import {
  MEDIA_USAGE_INSPECTOR_IMPORT,
  SANITY_MEDIA_STABLE_PREVIEW_IMPORT,
} from './admin/constants'
import { createSanityClient } from './client/createSanityClient'
import {
  collectionHasAltField,
  getLocalizationLocales,
  localizedAltGroupField,
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
  createSanityMediaPersistUpstreamBeforeChangeHook,
} from './hooks/media'
import { sanityMediaForceSelect } from './populate/forceSelect'
import { resolvePopulateOptionsForCollection } from './populate/resolvePopulateOptions'
import { createMediaReferenceIntegrityBeforeDeleteHook } from './hooks/mediaReferenceIntegrity'
import { createMediaReplaceSanityAssetAfterChangeHook } from './hooks/replaceSanityAsset'
import { warnSanityStorageConfig } from './utils/sanityConfig'
import { sanityAdminThumbnail } from './utils/sanityAdminThumbnail'
import { isSanitySyncEnabled } from './sync/enabled'
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
  const {
    projectId,
    dataset,
    token,
    apiVersion,
    cdnBaseUrl,
    collections,
    enabled = true,
    alwaysInsertFields = false,
    dedupeUploads = true,
    preventDeleteWhenReferenced = true,
    sync,
  } = options

  const client = createSanityClient({ projectId, dataset, token, apiVersion })
  const syncEnabled = isSanitySyncEnabled(sync)

  if (enabled) {
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
          adapter: enabled
            ? createSanityAdapter({ client, cdnBaseUrl, projectId, dataset, token })
            : null,
        },
      ]
    })
  )
  // SAFETY: entries mirror SanityStoragePluginOptions.collections shape for cloud-storage
  const cloudCollections = collectionsWithAdapter as CloudStoragePluginOptions['collections']

  const storagePlugin = cloudStoragePlugin({
    enabled,
    alwaysInsertFields,
    collections: cloudCollections,
  })

  const configuredMediaSlugs = new Set(Object.keys(collections))
  const endpoints: Endpoint[] = []

  if (syncEnabled && sync?.webhookSecret) {
    const mediaSlug = sync.webhookCollection ?? Object.keys(collections)[0]
    if (mediaSlug) {
      endpoints.push(
        createSanityWebhookEndpoint({
          client,
          collectionSlug: mediaSlug,
          webhookSecret: sync.webhookSecret,
          projectId,
          dataset,
          path: sync.webhookPath,
          onDeleted: sync.onDeleted,
        })
      )
    }
  }

  if (syncEnabled && sync?.reconcile !== false) {
    const mediaSlug = sync?.reconcileCollection ?? Object.keys(collections)[0]
    if (mediaSlug) {
      endpoints.push(
        createSanityReconcileEndpoint({
          client,
          collectionSlug: mediaSlug,
          path: sync?.reconcilePath,
        })
      )
    }
  }

  return (incomingConfig: Config): Config => {
    const config = storagePlugin(incomingConfig)
    const localizationLocales = getLocalizationLocales(config)

    return {
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

          const stableAdminThumbnail =
            collections[slug] === true
              ? true
              : (collections[slug].stableAdminThumbnail ?? true)

          const upload: UploadConfig = {
            ...uploadConfig,
            disableLocalStorage:
              collections[slug] === true ? true : (collections[slug].disableLocalStorage ?? true),
            crop: uploadConfig.crop ?? false,
            focalPoint: uploadConfig.focalPoint ?? false,
            hideRemoveFile: uploadConfig.hideRemoveFile ?? true,
            displayPreview:
              uploadConfig.displayPreview ??
              (stableAdminThumbnail ? false : true),
            adminThumbnail:
              uploadConfig.adminThumbnail ??
              (({ doc }) =>
                sanityAdminThumbnail(doc as SanityMediaDocument, { cdnBaseUrl })),
          }

          const stablePreviewField: Field = {
            name: 'sanityStablePreview',
            type: 'ui',
            admin: {
              components: {
                Field: SANITY_MEDIA_STABLE_PREVIEW_IMPORT,
              },
            },
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
          const uiFields: Field[] = stableAdminThumbnail
            ? [stablePreviewField, mediaUsageField]
            : [mediaUsageField]

          if (altOptions.enabled) {
            if (collectionHasAltField(existingFields)) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(
                  `[@klnap/payload-storage-sanity] collections.${slug}.alt.enabled but the collection already has an "alt" field; skipping alt injection.`
                )
              }
            } else if (localizationLocales.length === 0) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(
                  `[@klnap/payload-storage-sanity] collections.${slug}.alt.enabled but config.localization has no locales; skipping alt injection.`
                )
              }
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
              // Payload renders list thumbnails on the `filename` column (FileCell).
              defaultColumns:
                nextCollection.admin?.defaultColumns ??
                ['filename', 'name', 'id', 'updatedAt'],
            },
            fields: [...existingFields, ...altFields, ...uiFields],
            upload,
            hooks: mergeAfterReadHooks(nextCollection, [mediaAfterRead]),
          }

          nextCollection = {
            ...nextCollection,
            hooks: {
              ...nextCollection.hooks,
              beforeChange: [
                createSanityMediaBeforeChangeHook(),
                ...(nextCollection.hooks?.beforeChange ?? []),
                createSanityMediaPersistUpstreamBeforeChangeHook(),
              ],
            },
          }
        }

        if (dedupeUploads && enabled && configuredMediaSlugs.has(slug) && collection.upload) {
          nextCollection = {
            ...nextCollection,
            hooks: mergeDedupeHooks(nextCollection, slug),
          }
        }

        if (enabled && configuredMediaSlugs.has(slug) && collection.upload) {
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
            ]),
          }
        }

        return nextCollection
      }),
    }
  }
}
