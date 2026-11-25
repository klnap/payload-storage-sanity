import type { IdentifiedSanityDocumentStub, Mutation, SanityClient } from '@sanity/client'
import { parseSanityAssetFolderPath } from '@/core/config'

/** Creates the media plugin's folder hierarchy and assigns an asset atomically. */
export async function assignSanityAssetFolder(
  client: SanityClient,
  assetId: string,
  folderPath: string
): Promise<void> {
  const names = parseSanityAssetFolderPath(folderPath)
  const mutations: Mutation[] = []
  const path: string[] = []
  let folderId = ''

  for (const name of names) {
    const parentId = folderId
    path.push(name.toLowerCase())
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path.join('/')))
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
    folderId = `media.folder.${hash}`
    const folder: IdentifiedSanityDocumentStub = { _id: folderId, _type: 'media.folder', name }
    if (parentId) {
      folder.parent = { _type: 'reference', _ref: parentId, _weak: true }
    }
    mutations.push({ createIfNotExists: folder })
  }

  mutations.push({
    patch: {
      id: assetId,
      setIfMissing: { opt: {}, 'opt.media': {} },
      set: {
        'opt.media.folder': { _type: 'reference', _ref: folderId, _weak: true },
      },
    },
  })
  await client.mutate(mutations)
}
