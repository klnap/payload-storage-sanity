import { describe, expect, test } from 'bun:test'
import type { Config } from 'payload'

import {
  collectionHasAltField,
  getLocalizationLocales,
  localizedAltGroupField,
  resolveCollectionAltOptions,
} from '../../../src/fields/localizedAltGroup.js'

describe('localizedAltGroupField', () => {
  test('builds group with one text field per locale, not required by default', () => {
    const field = localizedAltGroupField([
      { code: 'pl', label: 'Polish' },
      { code: 'en', label: 'English' },
    ])

    expect(field.name).toBe('alt')
    expect(field.type).toBe('group')
    expect(field.fields).toHaveLength(2)
    expect(field.fields[0]).toMatchObject({ name: 'pl', type: 'text', required: false })
    expect(field.fields[1]).toMatchObject({ name: 'en', type: 'text', required: false })
    expect(field.fields[0].label).toBe('Alt — Polish')
  })

  test('honors required option', () => {
    const field = localizedAltGroupField([{ code: 'pl' }], { required: true })
    expect(field.fields[0]).toMatchObject({ required: true })
  })
})

describe('getLocalizationLocales', () => {
  test('reads locales from localization config object', () => {
    const config = {
      localization: {
        locales: [
          { code: 'pl', label: 'Polish' },
          { code: 'en', label: 'English' },
        ],
        defaultLocale: 'pl',
      },
    } as Config

    expect(getLocalizationLocales(config)).toEqual([
      { code: 'pl', label: 'Polish' },
      { code: 'en', label: 'English' },
    ])
  })

  test('returns empty when localization is disabled', () => {
    expect(getLocalizationLocales({ localization: false } as Config)).toEqual([])
  })
})

describe('resolveCollectionAltOptions', () => {
  test('defaults enabled true and required false for shorthand true', () => {
    expect(resolveCollectionAltOptions(true)).toEqual({ enabled: true, required: false })
  })

  test('defaults enabled true and required false for empty collection options', () => {
    expect(resolveCollectionAltOptions({})).toEqual({ enabled: true, required: false })
  })

  test('honors alt.enabled and alt.required', () => {
    expect(resolveCollectionAltOptions({ alt: { enabled: false } })).toEqual({
      enabled: false,
      required: false,
    })
    expect(resolveCollectionAltOptions({ alt: { required: true } })).toEqual({
      enabled: true,
      required: true,
    })
  })
})

describe('collectionHasAltField', () => {
  test('detects top-level alt field', () => {
    expect(
      collectionHasAltField([{ name: 'alt', type: 'text' }])
    ).toBe(true)
    expect(collectionHasAltField([{ name: 'title', type: 'text' }])).toBe(false)
  })
})
