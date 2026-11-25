import type { CollectionConfig, Field, UploadConfig } from 'payload'
import type {
  SanityStorageCollectionOptions,
  SanityStorageModeResolution,
  SanityStoragePluginOptions,
} from '@/core/config'
import { resolveCollectionAdmin } from '@/core/config'
import { SANITY_ADMIN_THUMBNAIL_WIDTH, sanityAdminThumbnail } from '@/features/media/cdn'
import {
  createSanityMediaAfterReadHook,
  createSanityMediaBeforeChangeHook,
  createSanityMediaEnsureCropSourceUrlBeforeOperationHook,
  createSanityMediaHydrateResponseAfterChangeHook,
  createSanityMediaPersistUpstreamBeforeChangeHook,
  createSanityMediaUrlFieldAfterReadHook,
  type SanityMediaDocument,
} from '@/features/media/document'
import {
  appendAfterReadToUrlField,
  collectionHasAltField,
  collectionHasTitleField,
  collectTopLevelFieldNames,
  finalizeSanityMediaCollectionFields,
  type LocaleLike,
  localizedAltGroupField,
  MEDIA_ASSET_UPLOAD_IMPORT,
  MEDIA_GALLERY_LIST_IMPORT,
  MEDIA_UPLOAD_BUSY_SHIELD_IMPORT,
  plainAltTextField,
  plainTitleField,
  resolveCollectionAltOptions,
} from '@/features/media/fields'
import {
  createMediaDedupeAfterOperationHook,
  createMediaDedupeBeforeChangeHook,
} from '@/features/media/lifecycle/dedupe'
import {
  createMediaReferenceIntegrityBeforeDeleteHook,
  createSanityMediaBulkDeleteBeforeOperationHook,
  createSanityMediaDeleteAfterOperationHook,
} from '@/features/media/lifecycle/delete'
import {
  createSanityMediaUploadMaxSizeBeforeChangeHook,
  createSanityUploadAfterChangeChain,
} from '@/features/media/lifecycle/upload'
import {
  presetUsesDefaultPopulate,
  resolvePopulateOptionsForCollection,
  sanityMediaDefaultPopulateSelect,
  sanityMediaForceSelect,
} from '@/features/media/populate'
import { createMediaUsageEndpoint } from '@/features/media/usage'

function mergeAfterReadHooks(
  collection: CollectionConfig,
  extraHooks: NonNullable<CollectionConfig['hooks']>['afterRead']
): CollectionConfig['hooks'] {
  return {
    ...collection.hooks,
    afterRead: [...(collection.hooks?.afterRead ?? []), ...(extraHooks ?? [])],
  }
}

function replaceCloudStorageAfterChangeWithUploadChain(
  collection: CollectionConfig,
  args: {
    cdnBaseUrl?: string
  }
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
    cloudHook,
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

export type ApplySanityMediaCollectionContext = {
  options: SanityStoragePluginOptions
  /** Enabled collections only; `false` entries are removed before this step. */
  collections: Record<string, true | SanityStorageCollectionOptions>
  configuredMediaSlugs: Set<string>
  localizationLocales: LocaleLike[]
  pluginAdmin: SanityStoragePluginOptions['admin']
  pluginUploadMaxSize: SanityStoragePluginOptions['uploadMaxSize']
  dedupeUploads: boolean
  preventDeleteWhenReferenced: boolean
  cloudStorageEnabled: boolean
  storageMode: SanityStorageModeResolution
  cdnBaseUrl?: string
}

/** Applies Sanity storage fields, hooks, upload config, and lifecycle guards to one media collection. */
export function applySanityStorageToMediaCollection(
  collection: CollectionConfig,
  ctx: ApplySanityMediaCollectionContext
): CollectionConfig {
  const slug = collection.slug
  let nextCollection: CollectionConfig = collection

  const {
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
  } = ctx

  if (configuredMediaSlugs.has(slug) && collection.upload) {
    const collOptions = collections[slug]
    if (collOptions === undefined) {
      throw new Error(`Missing storage options for configured media collection "${slug}".`)
    }
    const collectionAdmin = resolveCollectionAdmin(pluginAdmin, collOptions)
    const altOptions = resolveCollectionAltOptions(collOptions)
    const uploadConfig = collectionUploadConfig(collection)
    const populateResolved = resolvePopulateOptionsForCollection(options, slug)

    const collectionEndpoints = Array.isArray(nextCollection.endpoints)
      ? nextCollection.endpoints
      : []

    const upload: UploadConfig = {
      ...uploadConfig,
      disableLocalStorage: collOptions === true ? true : (collOptions.disableLocalStorage ?? true),
      imageSizes: [],
      crop: uploadConfig.crop ?? true,
      focalPoint: uploadConfig.focalPoint ?? true,
      hideRemoveFile: uploadConfig.hideRemoveFile ?? false,
      displayPreview: uploadConfig.displayPreview ?? true,
      adminThumbnail:
        uploadConfig.adminThumbnail ??
        (({ doc }) =>
          sanityAdminThumbnail(doc as SanityMediaDocument, {
            cdnBaseUrl,
            width: SANITY_ADMIN_THUMBNAIL_WIDTH,
          })),
    }

    const userFieldNames = new Set(collectTopLevelFieldNames(collection.fields ?? []))
    const existingFields = nextCollection.fields ?? []
    const altFields: Field[] = []

    if (altOptions.enabled) {
      if (collectionHasAltField(existingFields)) {
        if (process.env.NODE_ENV !== 'production') {
          // biome-ignore lint/suspicious/noConsole: development-only collection configuration warning
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

    // The asset title is on by default; a collection that defines its own `title` keeps it.
    const titleInput = !collectionHasTitleField(existingFields)
    if (titleInput) altFields.push(plainTitleField())

    const localizedAltGroup =
      altOptions.enabled && localizationLocales.length > 0 && !collectionHasAltField(existingFields)

    const mediaAfterRead = createSanityMediaAfterReadHook({
      collectionSlug: slug,
      cdnBaseUrl,
      resolvedPreset: populateResolved.preset,
      localPopulate: populateResolved.localPopulate,
      localizedAltGroup,
    })

    const mediaUrlFieldAfterRead = createSanityMediaUrlFieldAfterReadHook({ cdnBaseUrl })

    const usesDefaultPopulate = presetUsesDefaultPopulate(populateResolved.preset)

    const existingListComponent = nextCollection.admin?.components?.views?.list?.Component
    const existingEditComponents = nextCollection.admin?.components?.edit
    const uploadBusyShieldControls = collectionAdmin.uploadBusyShield
      ? [...(existingEditComponents?.beforeDocumentControls ?? []), MEDIA_UPLOAD_BUSY_SHIELD_IMPORT]
      : existingEditComponents?.beforeDocumentControls

    nextCollection = {
      ...nextCollection,
      defaultPopulate: usesDefaultPopulate ? sanityMediaDefaultPopulateSelect() : undefined,
      forceSelect: sanityMediaForceSelect(populateResolved.preset),
      endpoints: [...collectionEndpoints, createMediaUsageEndpoint({ mediaCollectionSlug: slug })],
      admin: {
        ...nextCollection.admin,
        disableCopyToLocale: nextCollection.admin?.disableCopyToLocale ?? true,
        useAsTitle: nextCollection.admin?.useAsTitle ?? 'id',
        defaultColumns: nextCollection.admin?.defaultColumns ?? ['filename', 'id', 'updatedAt'],
        components: {
          ...nextCollection.admin?.components,
          ...(collectionAdmin.gallery && !existingListComponent
            ? {
                views: {
                  ...nextCollection.admin?.components?.views,
                  list: {
                    ...nextCollection.admin?.components?.views?.list,
                    Component: {
                      path: MEDIA_GALLERY_LIST_IMPORT,
                      clientProps: {
                        hasCustomDocumentLinks: Boolean(nextCollection.admin?.formatDocURL),
                      },
                    },
                  },
                },
              }
            : undefined),
          edit: {
            ...existingEditComponents,
            Upload: existingEditComponents?.Upload ?? {
              path: MEDIA_ASSET_UPLOAD_IMPORT,
              clientProps: { ...(cdnBaseUrl ? { cdnBaseUrl } : {}), titleInput },
            },
            ...(uploadBusyShieldControls
              ? { beforeDocumentControls: uploadBusyShieldControls }
              : undefined),
          },
        },
      },
      fields: appendAfterReadToUrlField(
        finalizeSanityMediaCollectionFields([...existingFields, ...altFields], userFieldNames),
        mediaUrlFieldAfterRead
      ),
      upload,
      hooks: mergeAfterReadHooks(nextCollection, [mediaAfterRead]),
    }

    const collectionUploadMaxSize = collOptions === true ? undefined : collOptions.uploadMaxSize

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

  if (dedupeUploads && cloudStorageEnabled && configuredMediaSlugs.has(slug) && collection.upload) {
    nextCollection = {
      ...nextCollection,
      hooks: mergeDedupeHooks(nextCollection, slug),
    }
  }

  if (configuredMediaSlugs.has(slug) && collection.upload) {
    const collConfig = collections[slug]
    const shouldGuardReferenceIntegrity =
      typeof collConfig === 'object' && collConfig.preventDeleteWhenReferenced !== undefined
        ? collConfig.preventDeleteWhenReferenced
        : preventDeleteWhenReferenced

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
    if (cloudStorageEnabled) {
      if (storageMode.mode === 'full') {
        nextCollection = replaceCloudStorageAfterChangeWithUploadChain(nextCollection, {
          cdnBaseUrl,
        })
      }
    }
  }

  return nextCollection
}
