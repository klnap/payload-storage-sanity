import { SanityImage, sanityImageLoader } from '@klnap/payload-storage-sanity/next'

const asset = {
  id: 1,
  url: 'https://cdn.sanity.io/images/demo/production/example.jpg',
  alt: 'Example',
  width: 800,
  height: 600,
}

export default function Page() {
  const loaderUrl = sanityImageLoader({
    src: asset.url ?? '',
    width: 400,
    quality: 75,
  })

  return (
    <main>
      <p data-loader={loaderUrl}>next release consumer</p>
      <SanityImage asset={asset} alt={asset.alt ?? ''} />
    </main>
  )
}
