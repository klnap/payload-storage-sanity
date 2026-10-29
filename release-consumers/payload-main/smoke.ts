import { sanityStorage } from '@klnap/payload-storage-sanity'

const plugin = sanityStorage({
  projectId: 'p',
  dataset: 'd',
  token: 't',
  collections: { media: true },
})

if (typeof plugin !== 'function') {
  throw new Error('smoke: sanityStorage is not a function')
}
