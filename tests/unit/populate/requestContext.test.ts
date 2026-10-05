import { describe, expect, test } from 'bun:test'

import {
  readSanityStorageContext,
  SANITY_STORAGE_CONTEXT_KEY,
  shouldMorphMediaPopulate,
} from '../../../src/populate/requestContext.js'

describe('readSanityStorageContext', () => {
  test('reads nested sanityStorage object only', () => {
    expect(
      readSanityStorageContext({
        sanityStorage: { skipPopulate: true },
        otherPlugin: { foo: 1 },
      })
    ).toEqual({ skipPopulate: true })
  })

  test('SANITY_STORAGE_CONTEXT_KEY matches plugin namespace', () => {
    expect(SANITY_STORAGE_CONTEXT_KEY).toBe('sanityStorage')
  })
})

describe('shouldMorphMediaPopulate', () => {
  test('morphs when nested gate passes and config preset is default', () => {
    expect(
      shouldMorphMediaPopulate({
        context: {},
        configPreset: 'default',
        mediaCollectionSlug: 'media',
        shouldApplyNestedPopulate: true,
      })
    ).toBe(true)
  })

  test('does not morph when config is full', () => {
    expect(
      shouldMorphMediaPopulate({
        context: {},
        configPreset: 'full',
        mediaCollectionSlug: 'media',
        shouldApplyNestedPopulate: true,
      })
    ).toBe(false)
  })

  test('does not morph when request has explicit populate.media', () => {
    expect(
      shouldMorphMediaPopulate({
        context: {},
        configPreset: 'default',
        mediaCollectionSlug: 'media',
        req: {
          query: { populate: { media: { filename: true } } },
        } as never,
        shouldApplyNestedPopulate: true,
      })
    ).toBe(false)
  })

  test('respects shouldApplyNestedPopulate false', () => {
    expect(
      shouldMorphMediaPopulate({
        context: {},
        configPreset: 'default',
        mediaCollectionSlug: 'media',
        shouldApplyNestedPopulate: false,
      })
    ).toBe(false)
  })
})
