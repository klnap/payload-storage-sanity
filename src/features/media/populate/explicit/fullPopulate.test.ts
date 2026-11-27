import { describe, expect, test } from 'bun:test'

import {
  createPopulate,
  fullPopulate,
  getFullPopulateBase,
  type PopulateSelect,
} from '@/features/media/populate'

describe('fullPopulate', () => {
  test('includes sanity and sync in base', () => {
    const select = getFullPopulateBase()
    expect(select).toMatchObject({
      filename: true,
      sync: { status: true },
      sanity: { asset: { path: true, _id: true } },
    })
  })

  test('fullPopulate() returns base by default', () => {
    expect(fullPopulate()).toEqual(getFullPopulateBase())
  })

  test('createPopulate extend and exclude', () => {
    const populate = createPopulate({
      extend: { credit: true },
      exclude: ['mimeType'],
    })

    const result = populate({ exclude: ['thumbnailURL'] })
    expect(result).toMatchObject({ credit: true, filename: true })
    expect(result).not.toHaveProperty('mimeType')
    expect(result).not.toHaveProperty('thumbnailURL')
  })

  test('nested excludes do not mutate caller-provided extensions', () => {
    const extend: PopulateSelect = { customField: { nested: true } }
    const populate = createPopulate({
      extend,
      exclude: ['customField.nested'],
    })

    expect(populate()).not.toHaveProperty('customField.nested')
    expect(extend).toEqual({ customField: { nested: true } })
  })
})

describe('fullPopulate prototype safety', () => {
  const snapshotPrototype = () => Object.getOwnPropertyNames(Object.prototype).sort()

  test('an extend key named __proto__ does not change the returned prototype or Object.prototype', () => {
    const before = snapshotPrototype()
    const malicious = JSON.parse(
      '{"__proto__": {"polluted": true}, "title": true}'
    ) as PopulateSelect
    const select = fullPopulate({ extend: malicious })
    expect(Object.getPrototypeOf(select)).toBe(Object.prototype)
    expect(select.title).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(snapshotPrototype()).toEqual(before)
  })

  test('nested __proto__ keys are ignored and do not pollute', () => {
    const before = snapshotPrototype()
    const malicious = JSON.parse(
      '{"media": {"__proto__": {"polluted": true}, "url": true}}'
    ) as PopulateSelect
    const select = fullPopulate({ extend: malicious }) as Record<string, unknown>
    expect(Object.getPrototypeOf(select.media)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(snapshotPrototype()).toEqual(before)
  })

  test('exclude paths through __proto__ or inherited properties do not delete Object.prototype members', () => {
    const before = snapshotPrototype()
    const hadToString = Object.hasOwn(Object.prototype, 'toString')
    fullPopulate({
      exclude: [
        '__proto__.toString',
        '__proto__.hasOwnProperty',
        'constructor.prototype',
        'toString',
      ],
    })
    expect(Object.hasOwn(Object.prototype, 'toString')).toBe(hadToString)
    expect(snapshotPrototype()).toEqual(before)
  })

  test('exclude does not mutate caller-owned extend or exclude inputs', () => {
    const extend = { media: { url: true } } as PopulateSelect
    const exclude = ['media.url', 'title']
    const extendBefore = JSON.stringify(extend)
    const excludeBefore = JSON.stringify(exclude)
    fullPopulate({ extend, exclude })
    expect(JSON.stringify(extend)).toBe(extendBefore)
    expect(JSON.stringify(exclude)).toBe(excludeBefore)
  })

  test('ordinary extensions and exclusions still apply', () => {
    const select = fullPopulate({
      extend: { customField: true, media: { extraNested: true } } as PopulateSelect,
      exclude: ['customField'],
    }) as Record<string, unknown>
    expect(select.customField).toBeUndefined()
    expect((select.media as Record<string, unknown>).extraNested).toBe(true)
  })
})
