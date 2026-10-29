import { describe, expect, test } from 'bun:test'

import { resolvePopulateRequestLocale } from '@/features/media/populate'

describe('resolvePopulateRequestLocale', () => {
  test('prefers query.locale over req.locale', () => {
    expect(
      resolvePopulateRequestLocale({
        locale: 'en',
        query: { locale: 'pl' },
      } as never)
    ).toBe('pl')
  })

  test('reads locale from request url when query and req.locale are missing', () => {
    expect(
      resolvePopulateRequestLocale({
        url: 'http://localhost:4000/api/globals/home-page?depth=2&locale=pl',
      } as never)
    ).toBe('pl')
  })

  test('ignores locale=all', () => {
    expect(
      resolvePopulateRequestLocale({
        query: { locale: 'all' },
        locale: 'pl',
      } as never)
    ).toBe('pl')
  })
})
