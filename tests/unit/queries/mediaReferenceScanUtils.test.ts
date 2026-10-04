import { describe, expect, test } from 'bun:test'

import {
  publishedVersionStatusWhere,
  valueMatchesMediaId,
} from '../../../src/queries/mediaReferenceScanUtils.js'

describe('mediaReferenceScanUtils', () => {
  test('valueMatchesMediaId supports localized upload maps', () => {
    expect(valueMatchesMediaId({ pl: 5, en: null }, 5, ['pl', 'en'])).toBe(true)
    expect(valueMatchesMediaId({ pl: null, en: 7 }, 5, ['pl', 'en'])).toBe(false)
  })

  test('publishedVersionStatusWhere uses per-locale keys when localizeStatus is enabled', () => {
    const entity = {
      versions: {
        drafts: {
          localizeStatus: true,
        },
      },
    }
    expect(publishedVersionStatusWhere(entity, ['pl', 'en'])).toEqual({
      or: [
        { 'version._status.pl': { equals: 'published' } },
        { 'version._status.en': { equals: 'published' } },
      ],
    })
  })

  test('publishedVersionStatusWhere uses string _status without localizeStatus', () => {
    const entity = {
      versions: {
        drafts: true,
      },
    }
    expect(publishedVersionStatusWhere(entity, ['pl', 'en'])).toEqual({
      'version._status': { equals: 'published' },
    })
  })
})
