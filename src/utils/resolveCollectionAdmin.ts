import type { SanityStorageAdminOptions, SanityStorageCollectionOptions } from '../types/adapter'

export function resolveCollectionAdmin(
  pluginAdmin: SanityStorageAdminOptions | undefined,
  collOptions: true | SanityStorageCollectionOptions
): SanityStorageAdminOptions {
  const collAdmin = collOptions === true ? undefined : collOptions.admin

  return {
    uploadBusyShield:
      collAdmin?.uploadBusyShield ?? pluginAdmin?.uploadBusyShield ?? true,
    usageInspector: collAdmin?.usageInspector ?? pluginAdmin?.usageInspector ?? true,
  }
}
