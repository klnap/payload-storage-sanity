import { isMediaImageAsset } from '@klnap/payload-storage-sanity/consumers'
import { SanityImage, sanityImageLoader } from '@klnap/payload-storage-sanity/consumers/next'

const asset = {
  id: 1,
  url: 'https://cdn.sanity.io/images/demo/production/example.jpg',
  alt: 'Example',
  focalX: 50,
  focalY: 50,
  width: 800,
  height: 600,
}

export default function Page() {
  const loaderUrl = sanityImageLoader({
    src: asset.url ?? '',
    width: 400,
    quality: 75,
  })
  const image = isMediaImageAsset(asset) ? (
    <SanityImage asset={asset} alt={asset.alt ?? ''} />
  ) : null

  return (
    <main>
      <p data-loader={loaderUrl}>next release consumer</p>
      {image}
    </main>
  )
}
