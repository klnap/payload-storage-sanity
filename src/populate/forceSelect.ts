import type { CollectionConfig } from 'payload'

import type { SanityMediaPopulatePresetRegistry } from './presets'
import { presetUsesDefaultPopulate } from './presets'

type SanityMediaForceSelect = NonNullable<CollectionConfig['forceSelect']>

/** Base forceSelect so hidden `sanity` group is available to afterRead hooks. */
export function sanityMediaForceSelect(
  preset: string,
  registry: SanityMediaPopulatePresetRegistry = {}
): SanityMediaForceSelect {
  const base = {
    sanity: true,
    alt: true,
    sync: true,
    name: true,
    originalFilename: true,
    mimeType: true,
    url: true,
    width: true,
  } as SanityMediaForceSelect

  if (presetUsesDefaultPopulate(preset, registry)) {
    return {
      ...base,
      focalX: true,
      focalY: true,
    } as SanityMediaForceSelect
  }

  return base
}
