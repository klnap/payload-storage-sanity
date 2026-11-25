import type { PayloadRequest } from 'payload'

/**
 * Default gate for the reconcile route: a signed-in admin-auth-collection user.
 *
 * This only decides whether the route runs. The reads and writes it performs use the caller's own
 * Payload access (`overrideAccess: false`), so a user without media permissions is refused there.
 * Machine service principals (`type: 'service'`) are refused here; pass a custom `access` to allow them.
 */
export function defaultSanitySyncAccess({ req }: { req: PayloadRequest }): boolean {
  if (!req.user) {
    return false
  }
  if ((req.user as { type?: string }).type === 'service') {
    return false
  }

  const adminAuthSlug = req.payload.config.admin?.user ?? 'users'
  const userCollection = (req.user as { collection?: string }).collection

  return userCollection === adminAuthSlug
}
