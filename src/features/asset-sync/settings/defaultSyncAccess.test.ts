import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'
import { defaultSanitySyncAccess } from './defaultSyncAccess'

const req = (user: unknown, adminUser = 'users') =>
  ({ user, payload: { config: { admin: { user: adminUser } } } }) as unknown as PayloadRequest

describe('defaultSanitySyncAccess', () => {
  test('refuses anonymous requests and users from other auth collections', () => {
    expect(defaultSanitySyncAccess({ req: req(undefined) })).toBe(false)
    expect(defaultSanitySyncAccess({ req: req({ collection: 'customers' }) })).toBe(false)
  })

  test('admits a signed-in admin-auth-collection user (the route gate; writes are checked by media access)', () => {
    expect(defaultSanitySyncAccess({ req: req({ collection: 'users', id: '1' }) })).toBe(true)
  })

  test('refuses the IAM service principal by default', () => {
    expect(defaultSanitySyncAccess({ req: req({ collection: 'users', type: 'service' }) })).toBe(
      false
    )
  })
})
