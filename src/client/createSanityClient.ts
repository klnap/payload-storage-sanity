import { createClient, type SanityClient } from '@sanity/client'

import { SANITY_IMAGE_METADATA_EXTRACT } from '../types/asset'

export type SanityClientConfig = {
  projectId: string
  dataset: string
  token?: string
  apiVersion?: string
}

const clients = new Map<string, SanityClient>()

export function createSanityClient(config: SanityClientConfig): SanityClient {
  const cacheKey = `${config.projectId}:${config.dataset}:${config.apiVersion ?? 'vX'}`
  const existing = clients.get(cacheKey)
  if (existing) return existing

  const client = createClient({
    projectId: config.projectId,
    dataset: config.dataset,
    token: config.token,
    apiVersion: config.apiVersion ?? '2025-01-01',
    useCdn: false,
  })

  clients.set(cacheKey, client)
  return client
}

export { SANITY_IMAGE_METADATA_EXTRACT }
