import type { SanityClient } from '@sanity/client'
import type { CollectionAfterChangeHook } from 'payload'

import {
  clearPendingSanityAssets,
  rollbackPendingSanityAssets,
} from '../utils/uploadRollback'

export type SanityUploadAfterChangeChainArgs = {
  client: SanityClient
  cloudHook: CollectionAfterChangeHook
  replaceHook: CollectionAfterChangeHook
  hydrateHook: CollectionAfterChangeHook
}

/**
 * Runs cloud-storage upload + replace + hydrate in one afterChange so a failure
 * anywhere after Sanity upload can roll back pending assets for this request.
 */
export function createSanityUploadAfterChangeChain({
  client,
  cloudHook,
  replaceHook,
  hydrateHook,
}: SanityUploadAfterChangeChainArgs): CollectionAfterChangeHook {
  return async (args) => {
    try {
      let doc = args.doc
      doc = (await cloudHook(args)) ?? doc
      doc = (await replaceHook({ ...args, doc })) ?? doc
      doc = (await hydrateHook({ ...args, doc })) ?? doc
      clearPendingSanityAssets(args.req)
      return doc
    } catch (error) {
      await rollbackPendingSanityAssets(client, args.req)
      clearPendingSanityAssets(args.req)
      throw error
    }
  }
}
