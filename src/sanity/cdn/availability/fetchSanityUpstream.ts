import { isSanityCompatibleHost, type SanityCompatibleHostContext } from './isSanityCompatibleHost'

export type FetchSanityUpstreamContext = SanityCompatibleHostContext

/**
 * Fetches a Sanity CDN asset without following cross-host redirects (SSRF hardening).
 */
export async function fetchSanityUpstreamAsset(
  upstreamUrl: string,
  ctx: FetchSanityUpstreamContext = {}
): Promise<Response> {
  if (!isSanityCompatibleHost(upstreamUrl, ctx)) {
    return new Response(null, { status: 404 })
  }

  const response = await fetch(upstreamUrl, { redirect: 'manual' })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (location) {
      try {
        const redirectUrl = new URL(location, upstreamUrl).toString()
        if (!isSanityCompatibleHost(redirectUrl, ctx)) {
          return new Response(null, { status: 502 })
        }
        const redirected = await fetch(redirectUrl, { redirect: 'manual' })
        if (redirected.status >= 300 && redirected.status < 400) {
          return new Response(null, { status: 502 })
        }
        return redirected
      } catch {
        return new Response(null, { status: 502 })
      }
    }
    return new Response(null, { status: 502 })
  }

  return response
}
