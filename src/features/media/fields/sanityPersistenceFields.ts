import type { Field } from 'payload'

import { sanityAssetJsonGroup } from '@/features/media/fields'

/**
 * Persistence-only `sanity.asset` JSON — appended at collection root, not in any tab.
 * Shown nowhere in admin; hooks still merge upstream on metadata-only saves.
 */
export function sanityHiddenPersistenceFields(): Field[] {
  return [sanityAssetJsonGroup()]
}
