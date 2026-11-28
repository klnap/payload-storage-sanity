import type { CollectionAfterChangeHook } from 'payload'

export type SanityUploadAfterChangeChainArgs = {
  cloudHook: CollectionAfterChangeHook
  externalUploadHook?: CollectionAfterChangeHook
  hydrateHook: CollectionAfterChangeHook
}

/**
 * Runs external finalization, generated-size uploads, then response hydration.
 */
export function createSanityUploadAfterChangeChain({
  cloudHook,
  externalUploadHook,
  hydrateHook,
}: SanityUploadAfterChangeChainArgs): CollectionAfterChangeHook {
  return async (args) => {
    const externalDoc = await externalUploadHook?.(args)
    const cloudDoc =
      (await cloudHook(externalDoc ? { ...args, doc: externalDoc } : args)) ?? externalDoc
    const doc = cloudDoc ?? args.doc
    return (await hydrateHook({ ...args, doc })) ?? doc
  }
}
