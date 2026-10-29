import { describe, expect, test } from 'bun:test'
import type { Config, GroupField } from 'payload'

import {
  collectionHasAltField,
  getLocalizationLocales,
  localizedAltGroupField,
  resolveCollectionAltOptions,
} from '@/features/media/fields'
import { enTestT } from '../../helpers/enTestT'

function altGroupFromRow(field: ReturnType<typeof localizedAltGroupField>): GroupField {
  const inner = field.fields[0]
  expect(inner).toMatchObject({ name: 'alt', type: 'group' })
  return inner as GroupField
}

describe('localizedAltGroupField', () => {
  test('builds row → group with one text field per locale, not required by default', () => {
    const row = localizedAltGroupField([
      { code: 'pl', label: 'Polish' },
      { code: 'en', label: 'English' },
    ])

    expect(row).toMatchObject({ type: 'row' })
    const field = altGroupFromRow(row)
    expect(field.fields).toHaveLength(2)
    const plField = field.fields?.[0] as { label?: unknown }
    const plLabel =
      typeof plField?.label === 'function'
        ? (plField.label as (args: { t: typeof enTestT }) => string)({ t: enTestT })
        : plField?.label
    expect(field.fields?.[0]).toMatchObject({
      name: 'pl',
      type: 'text',
      required: false,
    })
    expect(plLabel).toBe('Alt — Polish')
    expect(field.fields?.[1]).toMatchObject({ name: 'en', type: 'text', required: false })
  })

  test('honors required option', () => {
    const field = altGroupFromRow(localizedAltGroupField([{ code: 'pl' }], { required: true }))
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
    expect(collectionHasAltField([{ name: 'alt', type: 'text' }])).toBe(true)
    expect(collectionHasAltField([{ name: 'title', type: 'text' }])).toBe(false)
  })

  test('detects alt group nested in a row', () => {
    expect(
      collectionHasAltField([
        {
          type: 'row',
          fields: [{ name: 'alt', type: 'group', fields: [] }],
        },
      ])
    ).toBe(true)
  })
})
