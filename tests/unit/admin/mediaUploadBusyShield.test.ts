import { describe, expect, test } from 'bun:test'

import { resolveUploadToastAction } from '../../../src/admin/uploadToastSync.js'

describe('resolveUploadToastAction', () => {
  test('none when disabled', () => {
    expect(
      resolveUploadToastAction({ busy: true, prevBusy: false, enabled: false })
    ).toBe('none')
  })

  test('show on busy rising edge', () => {
    expect(
      resolveUploadToastAction({ busy: true, prevBusy: false, enabled: true })
    ).toBe('show')
  })

  test('dismiss on busy falling edge', () => {
    expect(
      resolveUploadToastAction({ busy: false, prevBusy: true, enabled: true })
    ).toBe('dismiss')
  })

  test('none when busy unchanged', () => {
    expect(
      resolveUploadToastAction({ busy: true, prevBusy: true, enabled: true })
    ).toBe('none')
    expect(
      resolveUploadToastAction({ busy: false, prevBusy: false, enabled: true })
    ).toBe('none')
  })
})
