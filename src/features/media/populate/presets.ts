/** Built-in `full` keeps the Payload media document; `default` is the flat storefront DTO on populated relations. */
export type SanityMediaPopulateBuiltinPreset = 'full' | 'default'

const BUILTIN: SanityMediaPopulateBuiltinPreset[] = ['full', 'default']

export function isBuiltinPopulatePreset(name: string): name is SanityMediaPopulateBuiltinPreset {
  return (BUILTIN as string[]).includes(name)
}

export function presetUsesDefaultPopulate(preset: string): boolean {
  return preset === 'default'
}
