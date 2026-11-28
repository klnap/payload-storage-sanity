import type {
  SanityStorageCollectionOptions,
  SanityStorageOptions,
  UploadTransport,
} from '../../src'
import { sanityStorage } from '../../src'
import type { SanityUploadTicketClaims } from '../../src/upload-protocol'
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
const transport: UploadTransport = {
  endpoint: 'https://uploads.example.test/v1/upload',
  maxSizeBytes: 50 * 1024 * 1024,
  protocolVersion: 1,
  secret: 'a test secret with at least thirty-two bytes',
}
const uploadTicket: Pick<SanityUploadTicketClaims, 'operation' | 'version'> = {
  operation: 'create',
  version: 1,
}
sanityStorage({ ...credentials, upload: { transport } })
void collectionOptions
void pluginOptions
void uploadTicket
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
