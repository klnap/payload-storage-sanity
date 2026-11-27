import type { SanityStorageCollectionOptions, SanityStorageOptions } from '../../src'
import { sanityStorage } from '../../src'
import type { MediaAsset } from '../../src/consumers'
import { type MediaAsset as NextMediaAsset, SanityImage } from '../../src/consumers/next'

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
  heroImage: MediaAsset
}
declare const relationship: GeneratedMedia
const directImage = SanityImage({ asset: relationship.heroImage, sizes: '100vw' })
declare const nextMediaAsset: NextMediaAsset
const sharedType: MediaAsset = nextMediaAsset
void directImage
void sharedType

// @ts-expect-error Folder routing belongs to a collection, not the plugin.
sanityStorage({ ...credentials, folder: 'Payload' })
