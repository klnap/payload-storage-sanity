import { describe, expect, test } from 'bun:test'

import type { SanityStoragePluginOptions } from '../../../src/types/adapter.js'
import { resolvePopulateOptionsForCollection } from '../../../src/populate/resolvePopulateOptions.js'

describe('resolvePopulateOptionsForCollection', () => {
  const baseOptions: SanityStoragePluginOptions = {
    projectId: 'p',
    dataset: 'd',
    collections: { media: true },
  }

  test('defaults to default preset when populate omitted', () => {
    const resolved = resolvePopulateOptionsForCollection(baseOptions, 'media')
    expect(resolved.preset).toBe('default')
  })

  test('full preset is explicit opt-in', () => {
    const resolved = resolvePopulateOptionsForCollection(
      { ...baseOptions, populate: { preset: 'full' } },
      'media'
    )
    expect(resolved.preset).toBe('full')
  })

})
