import {
  isSanityCompatibleHost,
  type SanityCompatibleHostContext,
} from '../availability/isSanityCompatibleHost'
import { joinCdnOriginAndPath, trimTrailingSlash } from './joinCdnOriginAndPath'

/**
 * Points a Sanity-compatible URL at the configured `cdnBaseUrl` origin.
 * Unrelated URLs and URLs without a configured origin pass through unchanged.
 */
export function rewriteToCdnOrigin(url: string, ctx: SanityCompatibleHostContext = {}): string {
  const custom = ctx.cdnBaseUrl?.trim()
  if (!custom || !isSanityCompatibleHost(url, ctx)) return url

  try {
    const parsed = new URL(url)
    return joinCdnOriginAndPath(trimTrailingSlash(custom), parsed.pathname + parsed.search)
  } catch {
    return url
  }
}
