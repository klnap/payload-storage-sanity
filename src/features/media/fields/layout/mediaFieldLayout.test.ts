import { describe, expect, test } from 'bun:test'
import type { Field } from 'payload'

import {
  finalizeSanityMediaCollectionFields,
  prioritizeUserSidebarFields,
} from '@/features/media/fields'

function collectFields(fields: Field[]): Field[] {
  const out: Field[] = []
  for (const field of fields) {
    if (field.type === 'tabs' && 'tabs' in field && Array.isArray(field.tabs)) {
      for (const tab of field.tabs) {
        out.push(...collectFields(tab.fields ?? []))
      }
      continue
    }
    out.push(field)
  }
  return out
}

function sidebarNames(fields: Field[]): string[] {
  return fields
    .filter(
      (f): f is Field & { name: string } =>
        f.admin?.position === 'sidebar' && 'name' in f && typeof f.name === 'string'
    )
    .map((f) => f.name)
}

describe('prioritizeUserSidebarFields', () => {
  test('renders user sidebar fields above plugin sync', () => {
    const fields: Field[] = [
      { name: 'alt', type: 'text' },
      {
        name: 'credit',
        type: 'text',
        admin: { position: 'sidebar' },
      },
      {
        name: 'sync',
        type: 'group',
        admin: { position: 'sidebar' },
        fields: [],
      },
    ]

    const result = prioritizeUserSidebarFields(fields, new Set(['credit']))

    expect(sidebarNames(result)).toEqual(['credit', 'sync'])
  })
})

describe('finalizeSanityMediaCollectionFields', () => {
  test('strips default name when not declared on the collection', () => {
    const result = finalizeSanityMediaCollectionFields(
      [
        { name: 'name', type: 'text' },
        { name: 'alt', type: 'text' },
      ],
      new Set()
    )

    expect(result.some((f) => 'name' in f && f.name === 'name')).toBe(false)
    const tabs = result.find((f) => f.type === 'tabs')
    expect(tabs).toBeDefined()
    expect(collectFields(result).some((f) => 'name' in f && f.name === 'alt')).toBe(true)
  })
})
