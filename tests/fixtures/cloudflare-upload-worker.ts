import {
  type CloudflareUploadEnvironment,
  handleCloudflareUpload,
} from '@klnap/payload-storage-sanity/cloudflare'

const calls: Array<{ kind: string; streamed?: boolean; size?: number }> = []
const claimEndpoint = 'https://payload.example.test/api/sanity-upload/claims'

// biome-ignore lint/style/noDefaultExport: Wrangler Worker modules require a default fetch handler.
export default {
  fetch(request: Request, env: CloudflareUploadEnvironment): Promise<Response> | Response {
    if (new URL(request.url).pathname === '/__calls') return Response.json(calls)
    return handleCloudflareUpload(request, env, async (input, init) => {
      if (String(input) === claimEndpoint) {
        calls.push({ kind: 'claim' })
        return Response.json({ status: 'claimed', protocolVersion: 1 }, { status: 201 })
      }

      if (!(init?.body instanceof ReadableStream)) {
        throw new Error('Sanity request body was not streamed')
      }
      const reader = init.body.getReader()
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
      }
      calls.push({ kind: 'sanity', streamed: true, size })
      return Response.json({
        document: {
          _id: 'file-abc123-txt',
          _type: 'sanity.fileAsset',
          assetId: 'abc123',
          size,
          url: 'https://cdn.sanity.io/files/project/production/abc123.txt',
        },
      })
    })
  },
}
