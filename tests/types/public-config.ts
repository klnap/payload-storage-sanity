import type { SanityStorageCollectionOptions, SanityStorageOptions } from '../../src'
import { sanityStorage } from '../../src'

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

// @ts-expect-error Folder routing belongs to a collection, not the plugin.
sanityStorage({ ...credentials, folder: 'Payload' })
