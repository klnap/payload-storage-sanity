import type { SanityMediaDocument } from '../types/sanityStorageDocument'

/** Built-in `full` keeps the Payload media document; `default` is the flat storefront DTO on populated relations. */
export type SanityMediaPopulateBuiltinPreset = 'full' | 'default'

export type SanityMediaPopulatePresetContext = {
  assetType: 'image' | 'file'
  preset: string
  locale?: string | null
}

export type SanityMediaPopulatePreset = {
  shape?: (
    doc: SanityMediaDocument,
    ctx: SanityMediaPopulatePresetContext
  ) => Record<string, unknown>
}

export type SanityMediaPopulatePresetRegistry = Record<string, SanityMediaPopulatePreset>

const BUILTIN: SanityMediaPopulateBuiltinPreset[] = ['full', 'default']

export function isBuiltinPopulatePreset(name: string): name is SanityMediaPopulateBuiltinPreset {
  return (BUILTIN as string[]).includes(name)
}

export function defineSanityMediaPopulatePreset(
  name: string,
  def: SanityMediaPopulatePreset
): SanityMediaPopulatePreset {
  if (isBuiltinPopulatePreset(name)) {
    throw new Error(`Populate preset name "${name}" is reserved`)
  }
  return def
}

export function presetUsesDefaultPopulate(
  preset: string,
  registry: SanityMediaPopulatePresetRegistry
): boolean {
  if (preset === 'full') return false
  if (preset === 'default') return true
  return Boolean(registry[preset]?.shape)
}
