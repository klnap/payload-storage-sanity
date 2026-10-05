import { describe, expect, test } from 'bun:test'

import { resolveLocalizedAlt } from '../../../src/utils/resolveLocalizedAlt.js'

describe('resolveLocalizedAlt', () => {
  test('returns plain string alt', () => {
    expect(resolveLocalizedAlt('  hello  ', { locale: 'pl' })).toBe('hello')
  })

  test('returns only the requested locale key', () => {
    expect(
      resolveLocalizedAlt({ pl: 'Opis PL', en: 'Caption EN' }, { locale: 'pl' })
    ).toBe('Opis PL')
    expect(
      resolveLocalizedAlt({ pl: 'Opis PL', en: 'Caption EN' }, { locale: 'en' })
    ).toBe('Caption EN')
  })

  test('does not fall back to another locale', () => {
    expect(resolveLocalizedAlt({ pl: 'Opis PL' }, { locale: 'en' })).toBeNull()
    expect(resolveLocalizedAlt({ pl: 'Opis PL', en: 'EN' }, {})).toBeNull()
  })

  test('fallbackLocale when request locale is empty', () => {
    expect(
      resolveLocalizedAlt({ pl: 'Opis PL', en: 'Caption EN' }, {
        locale: 'de',
        fallbackLocale: 'en',
      })
    ).toBe('Caption EN')
  })

  test('request locale wins over fallbackLocale', () => {
    expect(
      resolveLocalizedAlt({ pl: 'Opis PL', en: 'Caption EN' }, {
        locale: 'pl',
        fallbackLocale: 'en',
      })
    ).toBe('Opis PL')
  })
})
