import {
  type CloudflareUploadEnvironment,
  handleCloudflareUpload,
} from './features/media/upload-transport/cloudflare/worker'

export type { CloudflareUploadEnvironment }
export { handleCloudflareUpload }

// biome-ignore lint/style/noDefaultExport: Cloudflare module Workers require a default fetch handler.
export default {
  fetch(request: Request, env: CloudflareUploadEnvironment): Promise<Response> {
    return handleCloudflareUpload(request, env)
  },
}
