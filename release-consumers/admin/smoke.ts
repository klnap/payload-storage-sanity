import { SanityStorageStyles } from '@klnap/payload-storage-sanity/admin'

if (typeof SanityStorageStyles !== 'function') {
  throw new Error('smoke: SanityStorageStyles missing')
}
