import { createSanityImage } from '@klnap/payload-storage-sanity/next'

const Mapped = createSanityImage({
  assetMapping: {
    url: 'image',
    width: 'metadata.width',
    height: 'metadata.height',
  },
})

if (typeof Mapped !== 'function') {
  throw new Error('smoke: createSanityImage did not return a component')
}
