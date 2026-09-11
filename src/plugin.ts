import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { PluginOptions as CloudStoragePluginOptions } from '@payloadcms/plugin-cloud-storage/types'
import type { CollectionConfig, Config, Endpoint, Field, Plugin, UploadConfig } from 'payload'

import { createSanityAdapter } from './adapter/createAdapter'
import { MEDIA_USAGE_INSPECTOR_IMPORT } from './admin/constants'
import { createSanityClient } from './client/createSanityClient'
import { createMediaUsageEndpoint } from './endpoints/mediaUsage'
import { createSanityReconcileEndpoint } from './endpoints/reconcile'
import { createSanityWebhookEndpoint } from './endpoints/webhook'
import {
  createMediaDedupeAfterOperationHook,
  createMediaDedupeBeforeChangeHook,
} from './hooks/dedupeUpload'
import { createMediaDeleteSanityAssetBeforeDeleteHook } from './hooks/deleteSanityAsset'
import { createSanityMediaAfterReadHook, createSanityMediaBeforeChangeHook } from './hooks/media'
import { createMediaReferenceIntegrityBeforeDeleteHook } from './hooks/mediaReferenceIntegrity'
import { createMediaReplaceSanityAssetAfterChangeHook } from './hooks/replaceSanityAsset'
import { isSanitySyncEnabled } from './sync/enabled'
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
    sync,
  } = options

  const client = createSanityClient({ projectId, dataset, token, apiVersion })
  const syncEnabled = isSanitySyncEnabled(sync)
  const mediaAfterRead = createSanityMediaAfterReadHook()

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
          adapter: enabled ? createSanityAdapter({ client, cdnBaseUrl }) : null,
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

    return {
      ...config,
      endpoints: [...(config.endpoints ?? []), ...endpoints],
      collections: (config.collections ?? []).map((collection) => {
        const slug = collection.slug
        const afterReadHooks = []

        if (mediaAfterRead && configuredMediaSlugs.has(slug) && collection.upload) {
          afterReadHooks.push(mediaAfterRead)
        }
        let nextCollection: CollectionConfig = collection

        if (configuredMediaSlugs.has(slug) && collection.upload) {
          const uploadConfig = collectionUploadConfig(collection)

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

          nextCollection = {
            ...nextCollection,
            endpoints: [
              ...collectionEndpoints,
              createMediaUsageEndpoint({ mediaCollectionSlug: slug }),
            ],
            admin: {
              ...nextCollection.admin,
              useAsTitle: nextCollection.admin?.useAsTitle ?? 'name',
              defaultColumns: nextCollection.admin?.defaultColumns ?? ['name', 'id', 'updatedAt'],
            },
            fields: [...(nextCollection.fields ?? []), mediaUsageField],
            upload,
          }
        }

        if (configuredMediaSlugs.has(slug) && collection.upload) {
          nextCollection = {
            ...nextCollection,
            hooks: {
              ...nextCollection.hooks,
              beforeChange: [
                createSanityMediaBeforeChangeHook(),
                ...(nextCollection.hooks?.beforeChange ?? []),
              ],
            },
          }
        }

        if (afterReadHooks.length > 0) {
          nextCollection = {
            ...nextCollection,
            hooks: mergeAfterReadHooks(nextCollection, afterReadHooks),
          }
        }

        if (dedupeUploads && enabled && configuredMediaSlugs.has(slug) && collection.upload) {
          nextCollection = {
            ...nextCollection,
            hooks: mergeDedupeHooks(nextCollection, slug),
          }
        }

        if (enabled && configuredMediaSlugs.has(slug) && collection.upload) {
          // Reference-integrity guard must run first so that a blocked deletion
          // never reaches the Sanity asset cleanup step.
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
