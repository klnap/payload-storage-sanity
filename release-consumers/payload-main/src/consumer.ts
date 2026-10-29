import { type SanityStorageOptions, sanityStorage } from '@klnap/payload-storage-sanity'

const options: SanityStorageOptions = {
  projectId: 'proj',
  dataset: 'production',
  token: 'test-token',
  collections: { media: true },
}

const plugin = sanityStorage(options)
if (typeof plugin !== 'function') {
  throw new Error('sanityStorage must return a Payload plugin function')
}
