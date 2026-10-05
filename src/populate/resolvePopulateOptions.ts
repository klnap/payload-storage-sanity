import type { SanityStoragePluginOptions } from '../types/adapter'
import { presetUsesDefaultPopulate } from './presets'

export type ResolvedPopulateOptions = {
  preset: string
  localPopulate: boolean
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

  const preset = collPopulate?.preset ?? pluginOptions.populate?.preset ?? 'default'

  const populateConfig = pluginOptions.populate
  const localPopulateExplicit =
    collPopulate && typeof collPopulate === 'object' && 'localPopulate' in collPopulate
      ? (collPopulate as { localPopulate?: boolean }).localPopulate
      : populateConfig?.localPopulate

  const localPopulate = localPopulateExplicit ?? (presetUsesDefaultPopulate(preset) ? true : false)

  return { preset, localPopulate }
}
