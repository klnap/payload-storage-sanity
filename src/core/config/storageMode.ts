export type SanityStorageMode = 'full' | 'fields-only' | 'off'

export type SanityStorageModeResolution = {
  mode: SanityStorageMode
  /** Passed to `@payloadcms/plugin-cloud-storage` `enabled`. */
  cloudStorageEnabled: boolean
  alwaysInsertFields: boolean
}
