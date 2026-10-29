/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@klnap/payload-storage-sanity'],
  images: {
    loader: 'custom',
    loaderFile: './src/image-loader.ts',
  },
}

export default nextConfig
