import { tv } from 'tailwind-variants'

/**
 * Applied on the media tabs field `admin.className` (`.pss-media-tabs`).
 * Payload Tabs only honor `admin.className` — not `admin.style`.
 */
export const mediaTabsFieldStyles = tv({
  base: [
    'pss-media-tabs',
    'mt-[calc(var(--base)*1.5)] border-t border-[var(--theme-elevation-150)] pt-[calc(var(--base)*1)]',
    '[&_.tabs-field__tabs]:!border-b-0',
    '[&_.tabs-field__tabs-wrap]:!mb-[calc(var(--base)*0.5)]',
    '[&_.pss-media-alt]:!m-0 [&_.pss-media-alt]:!border-0 [&_.pss-media-alt]:!p-0',
  ].join(' '),
})
