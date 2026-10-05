import type { SanityStoragePluginOptions } from '../types/adapter'
import { isSanitySyncEnabled } from '../sync/enabled'
import { resolveSanityStorageMode } from './sanityStorageMode'

export function validateSanityStoragePluginOptions(options: SanityStoragePluginOptions): void {
  const { projectId, dataset, token, mode: modeOption, sync } = options

  if (!projectId?.trim()) {
    throw new Error(
      '[@klnap/payload-storage-sanity] `projectId` is required on sanityStorage().'
    )
  }

  if (!dataset?.trim()) {
    throw new Error(
      '[@klnap/payload-storage-sanity] `dataset` is required on sanityStorage().'
    )
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
}
