export type SanityStorageMode = 'full' | 'fields-only' | 'off'

export type SanityStorageModeResolution = {
  mode: SanityStorageMode
  /** Passed to `@payloadcms/plugin-cloud-storage` `enabled`. */
  cloudStorageEnabled: boolean
  alwaysInsertFields: boolean
}

/** `full` = Sanity adapter + uploads; `fields-only` = metadata fields without adapter; `off` = plugin hooks/endpoints only where applicable. */
export function resolveSanityStorageMode(options: {
  mode?: SanityStorageMode
}): SanityStorageModeResolution {
  const mode = options.mode ?? 'full'

  switch (mode) {
    case 'full':
      return { mode, cloudStorageEnabled: true, alwaysInsertFields: false }
    case 'fields-only':
      return { mode, cloudStorageEnabled: false, alwaysInsertFields: true }
    case 'off':
      return { mode, cloudStorageEnabled: false, alwaysInsertFields: false }
    default:
      throw new Error(
        `[@klnap/payload-storage-sanity] Invalid mode "${String(mode)}". Use "full", "fields-only", or "off".`
      )
  }
}
