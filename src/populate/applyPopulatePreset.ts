import type { SanityMediaDocument } from '../types/sanityStorageDocument'
import type { ResolveLocalizedAltContext } from '../utils/resolveLocalizedAlt'
import type { ResolvePublicUrlContext } from '../utils/resolvePublicUrl'
import { defaultPopulateMediaDoc } from './defaultPopulateMediaDoc'

export type ApplyPopulatePresetContext = ResolvePublicUrlContext & ResolveLocalizedAltContext

export function applyPopulatePreset(
  doc: SanityMediaDocument,
  preset: string,
  ctx: ApplyPopulatePresetContext = {}
): SanityMediaDocument | Record<string, unknown> {
  if (preset === 'default') {
    return defaultPopulateMediaDoc(doc, ctx)
  }

  return doc
}
