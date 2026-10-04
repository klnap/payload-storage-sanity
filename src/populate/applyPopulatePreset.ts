import type { SanityMediaDocument } from '../types/sanityStorageDocument'
import { classifySanityAssetType } from '../utils/classifySanityAssetType'
import type { ResolvePublicUrlContext } from '../utils/resolvePublicUrl'
import { defaultPopulateMediaDoc } from './defaultPopulateMediaDoc'
import type { SanityMediaPopulatePresetRegistry } from './presets'
import { isBuiltinPopulatePreset } from './presets'

export type ApplyPopulatePresetContext = ResolvePublicUrlContext & {
  locale?: string | null
}

export function applyPopulatePreset(
  doc: SanityMediaDocument,
  preset: string,
  registry: SanityMediaPopulatePresetRegistry,
  ctx: ApplyPopulatePresetContext = {}
): SanityMediaDocument | Record<string, unknown> {
  const assetType = classifySanityAssetType(doc)

  if (!isBuiltinPopulatePreset(preset)) {
    const custom = registry[preset]
    if (custom?.shape) {
      return custom.shape(doc, {
        assetType,
        preset,
        locale: ctx.locale,
      })
    }
  }

  if (preset === 'default') {
    return defaultPopulateMediaDoc(doc, ctx)
  }

  return doc
}
