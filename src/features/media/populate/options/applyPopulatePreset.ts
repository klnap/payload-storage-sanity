import type { ResolvePublicUrlContext } from '@/features/media/cdn'
import type { SanityMediaDocument } from '@/features/media/document'
import type { ResolveLocalizedAltContext } from '@/features/media/populate'
import { defaultPopulateMediaDoc } from '../explicit/defaultPopulateMediaDoc'

export type ApplyPopulatePresetContext = ResolvePublicUrlContext & ResolveLocalizedAltContext

export function applyPopulatePreset(
  doc: SanityMediaDocument,
  preset: string,
  ctx: ApplyPopulatePresetContext = {}
): SanityMediaDocument | Record<string, unknown> {
  if (preset === 'default') {
    const flat = defaultPopulateMediaDoc(doc, ctx)
    if (flat != null) {
      return flat
    }
    return doc
  }

  return doc
}
