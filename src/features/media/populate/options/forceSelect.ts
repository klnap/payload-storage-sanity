import type { CollectionConfig } from 'payload'

import { presetUsesDefaultPopulate } from '@/features/media/populate'
import { localizedAltPopulateSelect } from './localizedAltSelect'

type SanityMediaForceSelect = NonNullable<CollectionConfig['forceSelect']>

/** Base forceSelect so hidden `sanity` group is available to afterRead hooks. */
export function sanityMediaForceSelect(
  preset: string,
  localeCodes: readonly string[] = []
): SanityMediaForceSelect {
  const base = {
    sanity: {
      asset: {
        metadata: {
          dimensions: true,
          lqip: true,
        },
      },
    },
    alt: localizedAltPopulateSelect(localeCodes),
    sync: true,
    url: true,
    width: true,
  } as SanityMediaForceSelect

  if (presetUsesDefaultPopulate(preset)) {
    return {
      ...base,
      focalX: true,
      focalY: true,
    } as SanityMediaForceSelect
  }

  return base
}
