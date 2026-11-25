import { PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE } from '@/core/i18n/constants'
import type { SanityStorageTranslateFn } from '@/core/i18n/translate'
import { sanityStoragePluginTranslations } from '@/core/i18n/translations'

const enStrings = sanityStoragePluginTranslations.en[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]

/** Resolves plugin English strings for unit tests (Payload `t` interpolation subset). */
export const enTestT: SanityStorageTranslateFn = (key, vars) => {
  const shortKey = key.includes(':') ? key.split(':')[1]! : key
  let out = enStrings[shortKey as keyof typeof enStrings] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.replaceAll(`{{${name}}}`, String(value))
    }
  }
  return out
}
