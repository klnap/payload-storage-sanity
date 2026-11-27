export type { MediaAsset } from './defaultPopulate'
export { defaultPopulateMediaDoc } from './explicit/defaultPopulateMediaDoc'
export { hasExplicitMediaPopulateSelect } from './explicit/explicitMediaPopulate'
export {
  createPopulate,
  fullPopulate,
  getFullPopulateBase,
  type PopulateFn,
  type PopulateOptions,
  type PopulateSelect,
} from './explicit/fullPopulate'
export { enrichMediaSanityMetadataForPopulate } from './metadata/enrichMetadataForPopulate'

export type { ResolveLocalizedAltContext } from './metadata/resolveLocalizedAlt'
export { resolveLocalizedAlt } from './metadata/resolveLocalizedAlt'
export { resolvePopulateRequestLocale } from './metadata/resolvePopulateRequestLocale'
export { applyPopulatePreset } from './options/applyPopulatePreset'
export { sanityMediaForceSelect } from './options/forceSelect'
export { sanityMediaDefaultPopulateSelect } from './options/mediaDefaultPopulateSelect'
export { resolvePopulateOptionsForCollection } from './options/resolvePopulateOptions'
export { shouldApplyDefaultPopulate } from './options/shouldApplyDefaultPopulate'
export { presetUsesDefaultPopulate } from './presets'
export {
  mergeSanityStorageContext,
  readSanityStorageContext,
  SANITY_STORAGE_CONTEXT_KEY,
  type SanityStorageRequestContext,
  shouldMorphMediaPopulate,
} from './requestContext'
