/** Reads the optional LQIP from payload-storage-sanity's persisted asset shape. */
export function getSanityLqip(doc: Record<string, unknown>) {
  const sanity = doc.sanity
  const asset =
    sanity && typeof sanity === 'object' && !Array.isArray(sanity)
      ? Reflect.get(sanity, 'asset')
      : undefined
  const metadata =
    asset && typeof asset === 'object' && !Array.isArray(asset)
      ? Reflect.get(asset, 'metadata')
      : undefined
  const lqip = metadata && typeof metadata === 'object' ? Reflect.get(metadata, 'lqip') : undefined

  return typeof lqip === 'string' ? lqip.trim() : ''
}
