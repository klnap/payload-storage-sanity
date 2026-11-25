import { describe, expect, test } from 'bun:test'

import { resolveLocalizedAlt } from '@/features/media/populate'

describe('resolveLocalizedAlt', () => {
  test('returns plain string alt, trimmed', () => {
    expect(resolveLocalizedAlt('  hello  ', { locale: 'pl' })).toBe('hello')
  })

  test('returns only the requested locale key', () => {
    expect(resolveLocalizedAlt({ pl: 'Opis PL', en: 'Caption EN' }, { locale: 'pl' })).toBe(
      'Opis PL'
    )
    expect(resolveLocalizedAlt({ pl: 'Opis PL', en: 'Caption EN' }, { locale: 'en' })).toBe(
      'Caption EN'
    )
  })

  test('missing translation returns null, never another language', () => {
    expect(resolveLocalizedAlt({ pl: 'Opis PL' }, { locale: 'en' })).toBeNull()
    expect(resolveLocalizedAlt({ pl: 'Opis PL', en: 'EN' }, {})).toBeNull()
    expect(resolveLocalizedAlt({ pl: 'Opis PL' }, { locale: null })).toBeNull()
  })

  test('explicitly empty translation returns empty string, not null', () => {
    expect(resolveLocalizedAlt({ pl: '', en: 'Caption' }, { locale: 'pl' })).toBe('')
    expect(resolveLocalizedAlt('', { locale: 'pl' })).toBe('')
  })

  test('whitespace-only translation is treated as missing', () => {
    expect(resolveLocalizedAlt({ pl: '   ' }, { locale: 'pl' })).toBeNull()
  })

  test('missing value returns null', () => {
    expect(resolveLocalizedAlt(undefined, { locale: 'pl' })).toBeNull()
    expect(resolveLocalizedAlt(null, { locale: 'pl' })).toBeNull()
  })
})
