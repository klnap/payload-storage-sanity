import { tv } from 'tailwind-variants'

export const mediaAssetUploadStyles = tv({
  slots: {
    root: 'relative',
    hero: [
      'group relative mb-[calc(var(--base)*1)] flex w-full items-center justify-center',
      'box-border overflow-hidden rounded-[var(--style-radius-m,4px)]',
      'border border-[var(--theme-elevation-150)] bg-[var(--theme-elevation-50)]',
      'h-[min(52vh,480px)] px-[calc(var(--base)*1)] py-[calc(var(--base)*1.25)]',
    ].join(' '),
    cropFrame: 'relative mx-auto h-full max-h-full w-auto max-w-full overflow-hidden',
    img: 'mx-auto block h-auto max-h-full w-auto max-w-full bg-transparent object-contain object-center',
    menu: [
      'absolute top-[calc(var(--base)*0.35)] right-[calc(var(--base)*0.25)] z-[1]',
      '!m-0 scale-125',
    ].join(' '),
  },
  variants: {
    hero: {
      true: {
        root: [
          '[&_.file-details]:!absolute [&_.file-details]:!m-[-1px] [&_.file-details]:!h-px',
          '[&_.file-details]:!w-px [&_.file-details]:!overflow-hidden [&_.file-details]:!border-0',
          '[&_.file-details]:!p-0 [&_.file-details]:![clip:rect(0,0,0,0)]',
          '[&_.file-details]:!whitespace-nowrap',
        ].join(' '),
      },
      false: {
        root: '',
      },
    },
    cropped: {
      true: {
        img: '!absolute !mx-0 !h-auto !w-auto !max-h-none !max-w-none',
      },
      false: {
        img: '',
      },
    },
  },
  defaultVariants: {
    hero: false,
    cropped: false,
  },
})
