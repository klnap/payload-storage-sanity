export type UploadToastAction = 'show' | 'dismiss' | 'none'

/** Sync Sonner upload toast with media upload busy state (edge-triggered). */
export function resolveUploadToastAction(args: {
  busy: boolean
  prevBusy: boolean
  enabled: boolean
}): UploadToastAction {
  if (!args.enabled) {
    return 'none'
  }

  if (args.busy && !args.prevBusy) {
    return 'show'
  }

  if (!args.busy && args.prevBusy) {
    return 'dismiss'
  }

  return 'none'
}
