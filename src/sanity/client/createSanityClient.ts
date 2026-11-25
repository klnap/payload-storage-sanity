import { createClient, type SanityClient } from '@sanity/client'

import { SANITY_IMAGE_METADATA_EXTRACT } from '@/sanity/assets'

export type SanityClientConfig = {
  projectId: string
  dataset: string
  token?: string
  apiVersion?: string
  resolveFetch?: NonNullable<Parameters<typeof createClient>[0]['resolveFetch']>
}

const clients = new Map<string, SanityClient>()

export function createSanityClient(config: SanityClientConfig): SanityClient {
  const cacheKey = JSON.stringify([
    config.projectId,
    config.dataset,
    config.apiVersion ?? 'vX',
    config.token ?? '',
  ])
  const existing = config.resolveFetch ? undefined : clients.get(cacheKey)
  if (existing) return existing

  const client = createClient({
    projectId: config.projectId,
    dataset: config.dataset,
    token: config.token,
    apiVersion: config.apiVersion ?? '2026-01-01',
    useCdn: false,
    ...(config.resolveFetch ? { resolveFetch: config.resolveFetch } : {}),
  })

  if (!config.resolveFetch) clients.set(cacheKey, client)
  return client
}

export { SANITY_IMAGE_METADATA_EXTRACT }
