import type { PayloadRequest } from 'payload'

/** Who may call sync reconcile / webhook admin routes. */
export type SanitySyncAccessFn = (args: { req: PayloadRequest }) => boolean
