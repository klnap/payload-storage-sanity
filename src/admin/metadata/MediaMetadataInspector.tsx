import type { UIFieldServerComponent } from 'payload'

import { MediaMetadataInspectorClient } from './MediaMetadataInspectorClient'

export const MediaMetadataInspector: UIFieldServerComponent = async ({ data }) => {
  const sanity = data?.sanity
  const asset =
    sanity != null && typeof sanity === 'object' && 'asset' in sanity ? sanity.asset : null

  return <MediaMetadataInspectorClient asset={asset} />
}
