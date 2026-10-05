import { stat } from 'node:fs/promises'

import type { Config, PayloadRequest } from 'payload'

import { isImageFileType } from './uploadBody'

/** 1 MiB — use in plugin config: `default: 25 * MB` */
export const MB = 1024 * 1024

export type SanityUploadMediaKind = 'image' | 'video' | 'file'

export type SanityStorageUploadMaxSizeByType = {
  image?: number
  video?: number
  file?: number
}

/** Max upload size in bytes. `default` applies when no `byType` rule matches. */
export type SanityStorageUploadMaxSizeConfig = {
  /** Limit for all kinds without a `byType` entry. */
  default?: number
  /** Per-kind overrides (may be lower or higher than `default`). */
  byType?: SanityStorageUploadMaxSizeByType
}

/** Shorthand: a number sets `default` only. */
export type SanityStorageUploadMaxSizeInput = number | SanityStorageUploadMaxSizeConfig

export function normalizeUploadMaxSizeConfig(
  input?: SanityStorageUploadMaxSizeInput
): SanityStorageUploadMaxSizeConfig | undefined {
  if (input == null) {
    return undefined
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) {
      return undefined
    }
    return { default: input }
  }

  return input
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'mpeg', 'mpg', 'wmv'])

/** Classifies an incoming upload for max-size policy. */
export function classifyUploadMediaKind(mimeType?: string, filename?: string): SanityUploadMediaKind {
  if (isImageFileType(mimeType, filename)) {
    return 'image'
  }

  if (mimeType?.startsWith('video/')) {
    return 'video'
  }

  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext && VIDEO_EXTENSIONS.has(ext)) {
      return 'video'
    }
  }

  return 'file'
}

/** Deep-merge `byType`: collection keys override plugin keys; other plugin keys stay. */
function mergeByType(
  plugin?: SanityStorageUploadMaxSizeByType,
  collection?: SanityStorageUploadMaxSizeByType
): SanityStorageUploadMaxSizeByType | undefined {
  const merged = {
    ...plugin,
    ...collection,
  }

  if (Object.keys(merged).length === 0) {
    return undefined
  }

  return merged
}

export function mergeUploadMaxSizeConfig(
  plugin?: SanityStorageUploadMaxSizeInput,
  collection?: SanityStorageUploadMaxSizeInput
): SanityStorageUploadMaxSizeConfig {
  const pluginConfig = normalizeUploadMaxSizeConfig(plugin) ?? {}
  const collectionConfig = normalizeUploadMaxSizeConfig(collection)
  const byType = mergeByType(pluginConfig.byType, collectionConfig?.byType)

  return {
    default: collectionConfig?.default ?? pluginConfig.default,
    ...(byType ? { byType } : {}),
  }
}

/**
 * Resolves the effective byte limit: `byType[kind]` when set, else `default`.
 * Collection config wins over plugin config for each field (see {@link mergeUploadMaxSizeConfig}).
 */
export function resolveUploadMaxSizeBytes(
  kind: SanityUploadMediaKind,
  merged: SanityStorageUploadMaxSizeConfig
): number | undefined {
  const specific =
    kind === 'image'
      ? merged.byType?.image
      : kind === 'video'
        ? merged.byType?.video
        : merged.byType?.file

  const limit = specific ?? merged.default
  if (limit == null || limit <= 0) {
    return undefined
  }

  return limit
}

export function uploadMaxSizeConfigHasLimits(merged: SanityStorageUploadMaxSizeConfig): boolean {
  if (merged.default != null && merged.default > 0) {
    return true
  }

  const byType = merged.byType
  if (!byType) return false

  return (
    (byType.image != null && byType.image > 0) ||
    (byType.video != null && byType.video > 0) ||
    (byType.file != null && byType.file > 0)
  )
}

function collectLimitBytesFromConfig(config: SanityStorageUploadMaxSizeConfig, into: number[]): void {
  if (config.default != null && config.default > 0) {
    into.push(config.default)
  }

  const byType = config.byType
  if (!byType) return

  for (const value of [byType.image, byType.video, byType.file]) {
    if (value != null && value > 0) {
      into.push(value)
    }
  }
}

/**
 * Largest configured byte limit across plugin + all media collections (merged per collection).
 * Used for Payload `bodyParser.limits.fileSize` so busboy rejects oversize uploads before buffering.
 */
export function computeMaxUploadByteLimit(
  plugin?: SanityStorageUploadMaxSizeInput,
  collectionEntries?: Record<string, true | { uploadMaxSize?: SanityStorageUploadMaxSizeInput }>
): number | undefined {
  const limits: number[] = []

  if (collectionEntries) {
    for (const coll of Object.values(collectionEntries)) {
      const collectionConfig = coll === true ? undefined : coll.uploadMaxSize
      const merged = mergeUploadMaxSizeConfig(plugin, collectionConfig)
      if (uploadMaxSizeConfigHasLimits(merged)) {
        collectLimitBytesFromConfig(merged, limits)
      }
    }
  } else {
    const normalizedPlugin = normalizeUploadMaxSizeConfig(plugin)
    if (normalizedPlugin && uploadMaxSizeConfigHasLimits(normalizedPlugin)) {
      collectLimitBytesFromConfig(normalizedPlugin, limits)
    }
  }

  if (limits.length === 0) {
    return undefined
  }

  return Math.max(...limits)
}

/**
 * Raises Payload `upload.limits.fileSize` for multipart requests (never lowers a larger value).
 * Payload merges `bodyParser` then `upload` for busboy; `upload` wins — we only set `upload`.
 * Existing `bodyParser.limits.fileSize` is still respected when computing the raised limit.
 */
export function applyPayloadUploadFileSizeLimit(config: Config, minFileSize: number): Config {
  const existingUpload = config.upload?.limits?.fileSize
  const existingBody = config.bodyParser?.limits?.fileSize
  const nextLimit = Math.max(
    minFileSize,
    existingUpload != null && existingUpload > 0 ? existingUpload : 0,
    existingBody != null && existingBody > 0 ? existingBody : 0
  )

  return {
    ...config,
    upload: {
      ...config.upload,
      limits: {
        ...config.upload?.limits,
        fileSize: nextLimit,
      },
    },
  }
}

export function formatBytesForMessage(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatUploadMaxSizeError(
  kind: SanityUploadMediaKind,
  actualBytes: number,
  limitBytes: number
): string {
  const kindLabel = kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'File'
  return `${kindLabel} is ${formatBytesForMessage(actualBytes)}; maximum allowed is ${formatBytesForMessage(limitBytes)}.`
}

export async function resolveIncomingUploadByteSize(req: PayloadRequest): Promise<number | null> {
  const file = req.file
  if (!file) {
    return null
  }

  if (typeof file.size === 'number' && file.size > 0) {
    return file.size
  }

  if (file.data?.length) {
    return file.data.length
  }

  if (file.tempFilePath) {
    try {
      const fileStat = await stat(file.tempFilePath)
      return fileStat.size
    } catch {
      return null
    }
  }

  return null
}
