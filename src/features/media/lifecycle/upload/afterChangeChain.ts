import type { CollectionAfterChangeHook } from 'payload'

export type SanityUploadAfterChangeChainArgs = {
  cloudHook: CollectionAfterChangeHook
  hydrateHook: CollectionAfterChangeHook
}

/**
 * Runs the cloud-storage upload and response hydration in one afterChange hook.
 */
export function createSanityUploadAfterChangeChain({
  cloudHook,
  hydrateHook,
}: SanityUploadAfterChangeChainArgs): CollectionAfterChangeHook {
  return async (args) => {
    const doc = (await cloudHook(args)) ?? args.doc
    return (await hydrateHook({ ...args, doc })) ?? doc
  }
}
