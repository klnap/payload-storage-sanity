import { createSanityClient } from '@klnap/payload-storage-sanity/client'

const client = createSanityClient({
  projectId: 'p',
  dataset: 'd',
  token: 't',
})

if (typeof client.fetch !== 'function') {
  throw new Error('smoke: client.fetch missing')
}
