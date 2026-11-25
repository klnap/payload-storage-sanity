import type { Config } from 'payload'
import { deepMergeSimple } from 'payload/shared'

import { PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE } from './constants'
import { sanityStoragePluginTranslations } from './translations'

/**
 * Merge plugin i18n with host config. English defaults are copied into every
 * `supportedLanguages` locale so admin UI languages like `pl` resolve keys
 * (Payload does not fall back to `en` per missing key).
 */
export function mergeSanityStorageTranslations(i18n: Config['i18n']): Config['i18n'] {
  const hostTranslations = i18n?.translations ?? {}
  let translations = deepMergeSimple(sanityStoragePluginTranslations, hostTranslations)

  const enNamespace = sanityStoragePluginTranslations.en[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]
  const supported = i18n?.supportedLanguages

  if (enNamespace && supported) {
    for (const lang of Object.keys(supported)) {
      if (lang === 'en') {
        continue
      }

      translations = deepMergeSimple(
        { [lang]: { [PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]: enNamespace } },
        translations
      )
    }
  }

  return {
    ...i18n,
    translations,
  }
}
