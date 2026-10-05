import type { PayloadRequest } from 'payload'

import { hasExplicitMediaPopulateSelect } from './explicitMediaPopulate'

export const SANITY_STORAGE_CONTEXT_KEY = 'sanityStorage'

/** Plugin-owned flags on `req.context.sanityStorage` (Local API; not used in storefront docs). */
export type SanityStorageRequestContext = {
  /** Return hydrated media document without morph/shape in `afterRead`. */
  skipPopulate?: boolean
  /** Force morph when nested-read gates would otherwise skip (does not bypass admin `req.user`). */
  forcePopulate?: boolean
}

export function readSanityStorageContext(context: unknown): SanityStorageRequestContext | undefined {
  if (context == null || typeof context !== 'object') {
    return undefined
  }
  const record = context as Record<string, unknown>
  const raw = record[SANITY_STORAGE_CONTEXT_KEY]
  if (raw == null || typeof raw !== 'object') {
    return undefined
  }
  return raw as SanityStorageRequestContext
}

export function shouldSkipPopulateMorph(context: unknown): boolean {
  return readSanityStorageContext(context)?.skipPopulate === true
}

export function shouldForcePopulateMorph(context: unknown): boolean {
  return readSanityStorageContext(context)?.forcePopulate === true
}

export function shouldMorphMediaPopulate(args: {
  context: unknown
  configPreset: string
  mediaCollectionSlug: string
  req?: PayloadRequest
  shouldApplyNestedPopulate: boolean
}): boolean {
  if (!args.shouldApplyNestedPopulate) {
    return false
  }

  if (args.configPreset === 'full') {
    return false
  }

  if (hasExplicitMediaPopulateSelect(args.req, args.mediaCollectionSlug)) {
    return false
  }

  return args.configPreset === 'default'
}
