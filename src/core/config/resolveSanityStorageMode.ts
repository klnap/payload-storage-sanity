import type { SanityStorageMode, SanityStorageModeResolution } from '@/core/config'
import { PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE } from '@/core/i18n'

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
        `[@klnap/${PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE}] Invalid mode "${String(mode)}". Use "full", "fields-only", or "off".`
      )
  }
}
