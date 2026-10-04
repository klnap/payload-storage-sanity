import type { SanityStoragePluginOptions } from '../types/adapter'
import type { SanityMediaPopulatePresetRegistry } from './presets'

export type ResolvedPopulateOptions = {
  preset: string
  registry: SanityMediaPopulatePresetRegistry
}

export function resolvePopulateOptionsForCollection(
  pluginOptions: SanityStoragePluginOptions,
  collectionSlug: string
): ResolvedPopulateOptions {
  const coll = pluginOptions.collections[collectionSlug]
  const collPopulate =
    coll != null && typeof coll === 'object' && 'populate' in coll
      ? (coll as { populate?: SanityStoragePluginOptions['populate'] }).populate
      : undefined

  const preset = collPopulate?.preset ?? pluginOptions.populate?.preset ?? 'full'

  const registry: SanityMediaPopulatePresetRegistry = {
    ...(pluginOptions.populate?.presets ?? {}),
    ...(collPopulate?.presets ?? {}),
  }

  return { preset, registry }
}
