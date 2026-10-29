import type { SanityMediaDocument } from '@/features/media/document'
import { getSanityAssetMetadata } from '@/sanity/assets'

/** Reads LQIP from persisted `sanity.asset.metadata` or a flat populate DTO. */
export function extractLqipFromMediaRow(
  row: SanityMediaDocument | null | undefined
): string | undefined {
  if (!row) return undefined

  const fromMetadata = getSanityAssetMetadata(row)?.lqip?.trim()
  if (fromMetadata) return fromMetadata

  const flat = row as { lqip?: string | null }
  const direct = flat.lqip?.trim()
  return direct || undefined
}
