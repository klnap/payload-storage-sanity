import type { SanityStoragePluginOptions } from '@/core/config'
import { isSanitySyncEnabled } from './isSanitySyncEnabled'
import { resolveSanityStorageMode } from './resolveSanityStorageMode'
import { validateSanityMediaFolderOption } from './mediaFolders'

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
      if (typeof collectionOptions === 'boolean') continue
      if (
        collectionOptions == null ||
        typeof collectionOptions !== 'object' ||
        Array.isArray(collectionOptions)
      ) {
        throw new Error(
          `[@klnap/payload-storage-sanity] \`collections.${slug}\` must be a boolean or a collection options object.`
        )
      }
      if (
        collectionOptions.enabled !== undefined &&
        typeof collectionOptions.enabled !== 'boolean'
      ) {
        throw new Error(
          `[@klnap/payload-storage-sanity] \`collections.${slug}.enabled\` must be a boolean.`
        )
      }
      if (collectionOptions.folder !== undefined) {
        try {
          validateSanityMediaFolderOption(collectionOptions.folder)
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

  if (options.folders !== undefined) {
    try {
      validateSanityMediaFolderOption(options.folders)
    } catch (error) {
      throw new Error(
        `[@klnap/payload-storage-sanity] \`folders\` is invalid: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
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

  const upload = options.upload
  if (
    upload !== undefined &&
    (upload == null || typeof upload !== 'object' || Array.isArray(upload))
  ) {
    throw new Error('[@klnap/payload-storage-sanity] `upload` must be an object.')
  }
  const transport = upload?.transport
  if (transport !== undefined) {
    if (transport == null || typeof transport !== 'object' || Array.isArray(transport)) {
      throw new Error(
        '[@klnap/payload-storage-sanity] `upload.transport` must be an HTTP transport configuration.'
      )
    }
    if (transport.protocolVersion !== 1) {
      throw new Error(
        '[@klnap/payload-storage-sanity] `upload.transport.protocolVersion` must be 1.'
      )
    }
    if (!Number.isSafeInteger(transport.maxSizeBytes) || transport.maxSizeBytes <= 0) {
      throw new Error(
        '[@klnap/payload-storage-sanity] `upload.transport.maxSizeBytes` must be a positive safe integer.'
      )
    }
    let endpoint: URL
    try {
      endpoint = new URL(transport.endpoint)
    } catch {
      throw new Error(
        '[@klnap/payload-storage-sanity] `upload.transport.endpoint` must be an absolute HTTPS URL.'
      )
    }
    const allowLocalHTTP =
      process.env.NODE_ENV !== 'production' &&
      endpoint.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    if (
      (endpoint.protocol !== 'https:' && !allowLocalHTTP) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      throw new Error(
        '[@klnap/payload-storage-sanity] `upload.transport.endpoint` must use HTTPS without credentials, query parameters, or a fragment.'
      )
    }
    if (
      typeof transport.secret !== 'string' ||
      new TextEncoder().encode(transport.secret).length < 32
    ) {
      throw new Error(
        '[@klnap/payload-storage-sanity] `upload.transport.secret` must be at least 32 UTF-8 bytes.'
      )
    }
  }

  assertValidWebhookMaxBodySizeBytes(sync?.webhook?.maxBodySizeBytes)
}
