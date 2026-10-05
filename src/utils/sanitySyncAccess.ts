import type { PayloadRequest } from 'payload'

export type SanitySyncAccessFn = (args: { req: PayloadRequest }) => boolean

/** Default: only Payload admin auth collection (usually `users`). */
export function defaultSanitySyncAccess({ req }: { req: PayloadRequest }): boolean {
  if (!req.user) {
    return false
  }

  const adminAuthSlug = req.payload.config.admin?.user ?? 'users'
  const userCollection = (req.user as { collection?: string }).collection

  return userCollection === adminAuthSlug
}
