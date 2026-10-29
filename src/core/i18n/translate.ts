import type { SANITY_STORAGE_I18N_KEYS } from './keys'

type SanityStorageI18nKey = (typeof SANITY_STORAGE_I18N_KEYS)[keyof typeof SANITY_STORAGE_I18N_KEYS]

/** Minimal `t` surface from `req.t` or `useTranslation().t`. */
export type SanityStorageTranslateFn = (key: string, vars?: Record<string, string>) => string

export function sanityStorageTranslate(
  t: SanityStorageTranslateFn,
  key: SanityStorageI18nKey,
  vars?: Record<string, string>
): string {
  return t(key, vars)
}
