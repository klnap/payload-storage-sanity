import { isSanityCompatibleHost, type SanityCompatibleHostContext } from './isSanityCompatibleHost'

export type FetchSanityUpstreamContext = SanityCompatibleHostContext & {
  headers?: HeadersInit
}

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

  const init = { headers: ctx.headers, redirect: 'manual' as const }
  const response = await fetch(upstreamUrl, init)

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (location) {
      try {
        const redirectUrl = new URL(location, upstreamUrl).toString()
        if (!isSanityCompatibleHost(redirectUrl, ctx)) {
          return new Response(null, { status: 502 })
        }
        const redirected = await fetch(redirectUrl, init)
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
