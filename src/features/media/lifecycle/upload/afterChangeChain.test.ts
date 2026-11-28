import { describe, expect, test } from 'bun:test'
import type { CollectionAfterChangeHook } from 'payload'
import { createSanityUploadAfterChangeChain } from './afterChangeChain'

describe('Sanity upload afterChange chain', () => {
  test('finalizes the external asset before generated-size uploads and hydration', async () => {
    const initial = { id: 'media-1', title: 'Original' }
    const external = { ...initial, sanity: { asset: { _id: 'external-asset' } } }
    const generated = { ...external, sizes: { thumbnail: { filename: 'thumbnail' } } }
    const calls: string[] = []
    const cloudHook: CollectionAfterChangeHook = async ({ doc }) => {
      calls.push(`cloud:${'sanity' in doc}`)
      return generated
    }
    const externalUploadHook: CollectionAfterChangeHook = async () => {
      calls.push('external')
      return external
    }
    const hydrateHook: CollectionAfterChangeHook = async ({ doc }) => {
      calls.push(`hydrate:${'sizes' in doc}`)
      return doc
    }
    const chain = createSanityUploadAfterChangeChain({
      cloudHook,
      externalUploadHook,
      hydrateHook,
    })

    await chain({ doc: initial } as never)

    expect(calls).toEqual(['external', 'cloud:true', 'hydrate:true'])
  })
})
