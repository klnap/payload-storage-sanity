import { describe, expect, test } from 'bun:test'

import {
  SANITY_UPSTREAM_WRITE_CONTEXT_KEY,
  sanityAssetJsonGroup,
  sanityMediaSyncFields,
} from '@/features/media/fields/mediaFields'

type AccessFn = (args: { req: { context?: Record<string, unknown> } }) => boolean

function sanityGroupAccess(): { create: AccessFn; update: AccessFn } {
  const field = sanityAssetJsonGroup() as unknown as {
    access: { create: AccessFn; update: AccessFn }
  }
  return field.access
}

describe('sanityAssetJsonGroup access', () => {
  test('denies client create and update of sanity.asset', () => {
    const access = sanityGroupAccess()

    expect(access.create({ req: { context: {} } })).toBe(false)
    expect(access.update({ req: { context: {} } })).toBe(false)
    expect(access.update({ req: { context: { skipCloudStorage: true } } })).toBe(false)
  })

  test('allows update only for the plugin upstream write flag', () => {
    const access = sanityGroupAccess()
    const req = { context: { [SANITY_UPSTREAM_WRITE_CONTEXT_KEY]: true } }

    expect(access.update({ req })).toBe(true)
    expect(access.create({ req })).toBe(false)
  })
})

describe('sanityMediaSyncFields access', () => {
  test('client update with sync.status is stripped; only the upstream write flag may set it', () => {
    const field = sanityMediaSyncFields() as unknown as {
      access: { create: AccessFn; update: AccessFn }
    }

    expect(field.access.create({ req: { context: {} } })).toBe(false)
    expect(field.access.update({ req: { context: {} } })).toBe(false)
    expect(
      field.access.update({ req: { context: { [SANITY_UPSTREAM_WRITE_CONTEXT_KEY]: true } } })
    ).toBe(true)
  })
})
