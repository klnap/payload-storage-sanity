import { describe, expect, test } from 'bun:test'
import type { Config } from 'payload'
import { deepMergeSimple } from 'payload/shared'

import { PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE } from '@/core/i18n/constants'
import { SANITY_STORAGE_I18N_KEYS } from '@/core/i18n/keys'
import { mergeSanityStorageTranslations } from '@/core/i18n/mergeSanityStorageTranslations'
import { sanityStoragePluginTranslations } from '@/core/i18n/translations'
import { sanityStorage } from '../../src/plugin'

describe('payload-storage-sanity i18n', () => {
  test('ships default English under the package namespace', () => {
    const en = sanityStoragePluginTranslations.en[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]
    expect(en.uploadBusy).toBe('Uploading…')
    expect(SANITY_STORAGE_I18N_KEYS.uploadBusy).toBe(
      `${PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE}:uploadBusy`
    )
  })

  test('every i18n key has a default English translation', () => {
    const en = sanityStoragePluginTranslations.en[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]
    for (const [shortKey, namespacedKey] of Object.entries(SANITY_STORAGE_I18N_KEYS)) {
      expect(String(namespacedKey)).toBe(`${PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE}:${shortKey}`)
      expect(en[shortKey as keyof typeof en]).toBeTypeOf('string')
      expect((en[shortKey as keyof typeof en] as string).length).toBeGreaterThan(0)
    }
  })

  test('host can supply a non-English locale override', () => {
    const merged = deepMergeSimple(sanityStoragePluginTranslations, {
      pl: {
        [PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]: {
          uploadBusy: 'Wgrywanie…',
        },
      },
    }) as typeof sanityStoragePluginTranslations & {
      pl: { [PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]: { uploadBusy: string } }
    }

    expect(merged.pl[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE].uploadBusy).toBe('Wgrywanie…')
    expect(merged.en[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE].uploadBusy).toBe('Uploading…')
  })

  test('deepMergeSimple lets host translations override plugin defaults', () => {
    const merged = deepMergeSimple(sanityStoragePluginTranslations, {
      en: {
        [PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]: {
          uploadBusy: 'Host busy message',
        },
      },
    }) as typeof sanityStoragePluginTranslations

    expect(merged.en[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE].uploadBusy).toBe('Host busy message')
    expect(merged.en[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE].usageType).toBe('Type')
  })

  test('mergeSanityStorageTranslations copies English namespace into supported admin locales', () => {
    const merged = mergeSanityStorageTranslations({
      fallbackLanguage: 'en',
      supportedLanguages: { en: {}, pl: {}, de: {} },
    })

    const pl = merged?.translations?.pl?.[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]
    expect(pl?.fieldAltLocaleLabel).toBe('Alt — {{locale}}')
    expect(pl?.uploadBusy).toBe('Uploading…')
  })

  test('host non-English overrides still win after locale copy', () => {
    const merged = mergeSanityStorageTranslations({
      fallbackLanguage: 'en',
      supportedLanguages: { en: {}, pl: {} },
      translations: {
        pl: {
          [PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]: {
            uploadBusy: 'Wgrywanie…',
          },
        },
      },
    })

    const pl = merged?.translations?.pl?.[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]
    expect(pl?.uploadBusy).toBe('Wgrywanie…')
    expect(pl?.fieldAltLocaleLabel).toBe('Alt — {{locale}}')
  })

  test('sanityStorage() merges plugin translations before applying host config', () => {
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
    })

    const incoming = {
      secret: 'test',
      db: {} as Config['db'],
      collections: [{ slug: 'media', upload: true, fields: [] }],
      i18n: {
        fallbackLanguage: 'en',
        supportedLanguages: { en: {}, pl: {} },
        translations: {
          en: {
            [PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]: {
              uploadBusy: 'Overridden by host',
            },
          },
        },
      },
    } as Config

    const config = plugin(incoming)
    if (config instanceof Promise) {
      throw new Error('expected sync plugin result')
    }

    const hostTranslations = config.i18n?.translations as typeof sanityStoragePluginTranslations
    expect(hostTranslations?.en?.[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]?.uploadBusy).toBe(
      'Overridden by host'
    )
    expect(hostTranslations?.en?.[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]?.usageSearch).toBe(
      'Search by Type, Status, Document, or Field'
    )
    expect(hostTranslations?.pl?.[PAYLOAD_STORAGE_SANITY_I18N_NAMESPACE]?.fieldAltLocaleLabel).toBe(
      'Alt — {{locale}}'
    )
  })
})
