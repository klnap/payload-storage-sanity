import type { SanityStoragePluginOptions } from '@/core/config'
import { isSanitySyncEnabled } from './isSanitySyncEnabled'
import { resolveSanityStorageMode } from './resolveSanityStorageMode'
import { parseSanityAssetFolderPath } from './sanityFolderPath'

function assertValidWebhookMaxBodySizeBytes(value: unknown): void {
  if (value === undefined) return
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      '[@klnap/payload-storage-sanity] `sync.webhook.maxBodySizeBytes` must be a positive finite integer (bytes).'
    )
  }
}

export function validateSanityStoragePluginOptions(options: SanityStoragePluginOptions): void {
  const { projectId, dataset, token, mode: modeOption, sync } = options

  if (!projectId?.trim()) {
    throw new Error('[@klnap/payload-storage-sanity] `projectId` is required on sanityStorage().')
  }

  if (!dataset?.trim()) {
    throw new Error('[@klnap/payload-storage-sanity] `dataset` is required on sanityStorage().')
  }

  if (options.collections !== undefined) {
    if (
      options.collections == null ||
      typeof options.collections !== 'object' ||
      Array.isArray(options.collections)
    ) {
      throw new Error(
        '[@klnap/payload-storage-sanity] `collections` must be an object keyed by Payload upload collection slug.'
      )
    }

    for (const [slug, collectionOptions] of Object.entries(options.collections)) {
      if (!slug.trim()) {
        throw new Error(
          '[@klnap/payload-storage-sanity] `collections` keys must be non-empty Payload collection slugs.'
        )
      }
      if (
        collectionOptions !== true &&
        (collectionOptions == null ||
          typeof collectionOptions !== 'object' ||
          Array.isArray(collectionOptions))
      ) {
        throw new Error(
          `[@klnap/payload-storage-sanity] \`collections.${slug}\` must be true or a collection options object.`
        )
      }
      if (collectionOptions !== true && collectionOptions.folder !== undefined) {
        try {
          parseSanityAssetFolderPath(collectionOptions.folder)
        } catch (error) {
          throw new Error(
            `[@klnap/payload-storage-sanity] \`collections.${slug}.folder\` is invalid: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        }
      }
    }
  }

  const storageMode = resolveSanityStorageMode({ mode: modeOption })
  if (storageMode.cloudStorageEnabled && !token?.trim()) {
    throw new Error(
      '[@klnap/payload-storage-sanity] `token` is required when mode is "full" (Sanity uploads).'
    )
  }

  if (isSanitySyncEnabled(sync) && !token?.trim()) {
    throw new Error(
      '[@klnap/payload-storage-sanity] `token` is required when sync.enabled is true (webhook + reconcile fetch Sanity).'
    )
  }

  if (isSanitySyncEnabled(sync) && !sync?.webhook?.secret?.trim()) {
    throw new Error(
      '[@klnap/payload-storage-sanity] `sync.webhook.secret` is required when sync.enabled is true.'
    )
  }

  assertValidWebhookMaxBodySizeBytes(sync?.webhook?.maxBodySizeBytes)
}
