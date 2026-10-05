import type {
  Adapter,
  GeneratedAdapter,
  HandleUpload,
} from '@payloadcms/plugin-cloud-storage/types'

import { sanityAssetIdFromDocument } from './metadata'
import { registerPendingSanityAsset } from '../utils/uploadRollback'
import type { SanityAssetIdCarrier } from '../utils/payloadMedia'

/** Registers uploaded Sanity asset IDs on `req.context` for compensating delete on persist failure. */
export function wrapSanityAdapterForUploadRollback(inner: Adapter): Adapter {
  return (adapterArgs): GeneratedAdapter => {
    const generated = inner(adapterArgs)
    const { handleUpload: innerHandleUpload } = generated

    return {
      ...generated,
      handleUpload: (async (args) => {
        const result = await innerHandleUpload(args)
        if (result != null && typeof result === 'object') {
          const assetId = sanityAssetIdFromDocument(result as SanityAssetIdCarrier)
          if (assetId) {
            registerPendingSanityAsset(args.req, assetId)
          }
        }
        return result
      }) as HandleUpload,
    }
  }
}
