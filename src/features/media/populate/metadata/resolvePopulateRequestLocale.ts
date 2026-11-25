import type { PayloadRequest } from 'payload'

const asLocaleCode = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'all') return undefined
  return trimmed
}

function localeFromUrl(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url) return undefined
  try {
    const parsed = new URL(url, 'http://payload.internal')
    return asLocaleCode(parsed.searchParams.get('locale'))
  } catch {
    return undefined
  }
}

/** Locale for localized `alt` on nested media reads when `req.locale` is unset (REST/SDK globals). */
export function resolvePopulateRequestLocale(req?: PayloadRequest | null): string | undefined {
  if (!req) return undefined

  const query = req.query as Record<string, unknown> | undefined

  return asLocaleCode(query?.locale) ?? asLocaleCode(req.locale) ?? localeFromUrl(req.url)
}
