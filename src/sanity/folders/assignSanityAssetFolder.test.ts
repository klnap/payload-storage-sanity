import { describe, expect, mock, test } from 'bun:test'
import type { Mutation, SanityClient } from '@sanity/client'
import { assignSanityAssetFolder } from '@/sanity/folders'

describe('Sanity media folders', () => {
  test('creates a root and child folder and assigns the asset in one transaction', async () => {
    const mutate = mock(async (_mutations: Mutation[]) => ({}))
    const client = { mutate } as unknown as SanityClient

    await assignSanityAssetFolder(client, 'image-photo', '/services/signature-generator')

    expect(mutate).toHaveBeenCalledTimes(1)
    const mutations = mutate.mock.calls[0]?.[0] ?? []
    expect(mutations).toHaveLength(3)
    expect(mutations[0]).toMatchObject({
      createIfNotExists: {
        _type: 'media.folder',
        name: 'services',
      },
    })
    expect(mutations[1]).toMatchObject({
      createIfNotExists: {
        _type: 'media.folder',
        name: 'signature-generator',
        parent: {
          _type: 'reference',
          _weak: true,
        },
      },
    })
    expect(mutations[2]).toMatchObject({
      patch: {
        id: 'image-photo',
        setIfMissing: {
          opt: {},
          'opt.media': {},
          'opt.media.folder': {
            _type: 'reference',
            _weak: true,
          },
        },
      },
    })
    const folders = mutations.flatMap((mutation) =>
      'createIfNotExists' in mutation ? [mutation.createIfNotExists] : []
    )
    expect(String(folders[0]?._id)).toMatch(/^media\.folder\.[a-f0-9]{64}$/)
    expect(String(folders[1]?._id)).toMatch(/^media\.folder\.[a-f0-9]{64}$/)
    expect(folders[1]?.parent._ref).toBe(folders[0]?._id)
    expect(
      (mutations[2] as { patch: { setIfMissing: { 'opt.media.folder': { _ref: string } } } }).patch
        .setIfMissing['opt.media.folder']._ref
    ).toBe(folders[1]?._id)
    expect(mutations[2]).toMatchObject({
      patch: { setIfMissing: { 'opt.media.folder': { _ref: folders[1]?._id } } },
    })
  })

  test('normalizes paths and uses stable IDs for repeated and concurrent uploads', async () => {
    const mutate = mock(async (_mutations: Mutation[]) => ({}))
    const client = { mutate } as unknown as SanityClient
    await Promise.all([
      assignSanityAssetFolder(client, 'image-one', '/ Payload / Blog /'),
      assignSanityAssetFolder(client, 'image-two', 'Payload/Blog'),
    ])

    const [first, second] = mutate.mock.calls.map(([mutations]) => mutations)
    expect(first[0]).toEqual(second[0])
    expect(first[1]).toEqual(second[1])
    expect(first[2]).toMatchObject({ patch: { id: 'image-one' } })
    expect(second[2]).toMatchObject({ patch: { id: 'image-two' } })
  })

  test('does not move a shared asset when uploads target different folders', async () => {
    const mutate = mock(async (_mutations: Mutation[]) => ({}))
    const client = { mutate } as unknown as SanityClient
    await Promise.all([
      assignSanityAssetFolder(client, 'image-shared', 'website/media'),
      assignSanityAssetFolder(client, 'image-shared', 'shop/products'),
    ])

    for (const [mutations] of mutate.mock.calls) {
      const assignment = mutations.at(-1)
      expect(assignment).toMatchObject({
        patch: {
          id: 'image-shared',
          setIfMissing: { 'opt.media.folder': { _type: 'reference', _weak: true } },
        },
      })
      expect(assignment).not.toHaveProperty('patch.set')
    }
  })

  test('distinguishes the same child name under different parents', async () => {
    const mutate = mock(async (_mutations: Mutation[]) => ({}))
    const client = { mutate } as unknown as SanityClient
    await assignSanityAssetFolder(client, 'image-one', 'Payload/Photos')
    await assignSanityAssetFolder(client, 'image-two', 'Services/Photos')
    const folderIds = mutate.mock.calls.map(([mutations]) =>
      mutations.flatMap((mutation) =>
        'createIfNotExists' in mutation ? [mutation.createIfNotExists._id] : []
      )
    )
    expect(folderIds[0]?.[1]).not.toBe(folderIds[1]?.[1])
  })

  test('rejects empty paths before any mutation', async () => {
    const mutate = mock(async () => ({}))
    const client = { mutate } as unknown as SanityClient
    await expect(assignSanityAssetFolder(client, 'image-photo', '/ /')).rejects.toThrow(/folder/)
    expect(mutate).not.toHaveBeenCalled()
  })

  test('propagates folder mutation failures', async () => {
    const client = {
      mutate: mock(async () => {
        throw new Error('Folder write forbidden')
      }),
    } as unknown as SanityClient
    await expect(assignSanityAssetFolder(client, 'image-photo', 'Payload')).rejects.toThrow(
      'Folder write forbidden'
    )
  })
})
