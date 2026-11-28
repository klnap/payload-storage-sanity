import type { UploadTransport } from '@/core/config'

const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024

export type CloudflareTransportOptions = {
  workerUrl: string
  secret: string
  maxSizeBytes?: number
}

export function cloudflareTransport({
  workerUrl,
  secret,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
}: CloudflareTransportOptions): UploadTransport {
  return {
    endpoint: workerUrl,
    maxSizeBytes,
    protocolVersion: 1,
    secret,
  }
}
