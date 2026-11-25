import {
  createSanityClient,
  SANITY_IMAGE_METADATA_EXTRACT,
} from '@klnap/payload-storage-sanity/client'

const client = createSanityClient({
  projectId: 'proj',
  dataset: 'production',
  token: 'token',
})

if (!client || typeof client.fetch !== 'function') {
  throw new Error('createSanityClient did not return a client')
}

if (!SANITY_IMAGE_METADATA_EXTRACT) {
  throw new Error('SANITY_IMAGE_METADATA_EXTRACT missing')
}
