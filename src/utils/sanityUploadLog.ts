export const SANITY_UPLOAD_LOG_PREFIX = '[@klnap/payload-storage-sanity]'

export function logSanityUploadIssue(
  summary: string,
  context?: Record<string, unknown> | unknown
): void {
  console.error(`${SANITY_UPLOAD_LOG_PREFIX} ${summary}`)
  if (context !== undefined) {
    console.error(context)
  }
}
