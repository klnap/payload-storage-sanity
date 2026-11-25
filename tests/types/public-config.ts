import type { SanityStorageCollectionOptions, SanityStorageOptions } from '../../src'
import { sanityStorage } from '../../src'
import type { DefaultPopulateAsset } from '../../src/consumers'
import { isDefaultPopulateAsset } from '../../src/consumers'

const credentials = {
  projectId: 'project',
  dataset: 'production',
  token: 'token',
}

sanityStorage(credentials)
sanityStorage({ ...credentials, collections: {} })
sanityStorage({
  ...credentials,
  collections: {
    media: true,
    documents: { folder: 'website/documents' },
  },
})

const collectionOptions: SanityStorageCollectionOptions = { folder: 'website/media' }
const pluginOptions: SanityStorageOptions = { ...credentials }
void collectionOptions
void pluginOptions
type GeneratedMedia = {
  id: number
  url: string | null
  alt?: { en?: string | null }
}
const relationship: GeneratedMedia | number | null = null
if (isDefaultPopulateAsset(relationship)) {
  const normalized: DefaultPopulateAsset = relationship
  void normalized
}

// @ts-expect-error Folder routing belongs to a collection, not the plugin.
sanityStorage({ ...credentials, folder: 'Payload' })
