import { describe, expect, test } from 'bun:test'
import type { Field } from 'payload'

import {
  finalizeSanityMediaCollectionFields,
  prioritizeUserSidebarFields,
} from '../../../src/fields/mediaFieldLayout.js'

function sidebarNames(fields: Field[]): string[] {
  return fields
    .filter((f) => f.admin?.position === 'sidebar' && 'name' in f && f.name)
    .map((f) => f.name as string)
}

describe('prioritizeUserSidebarFields', () => {
  test('renders user sidebar fields above plugin originalFilename and sync', () => {
    const fields: Field[] = [
      { name: 'alt', type: 'text' },
      {
        name: 'originalFilename',
        type: 'text',
        admin: { position: 'sidebar' },
      },
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

    expect(sidebarNames(result)).toEqual(['credit', 'originalFilename', 'sync'])
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
    expect(result.some((f) => 'name' in f && f.name === 'alt')).toBe(true)
  })
})
