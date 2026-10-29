import { createSanityImageLoader } from '@klnap/payload-storage-sanity/next'
import loader from '@klnap/payload-storage-sanity/next/loader'

const fromNext = createSanityImageLoader()
const fromDefault = loader

if (typeof fromNext !== 'function' || typeof fromDefault !== 'function') {
  throw new Error('smoke: loader exports must be functions')
}
