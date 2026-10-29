import { isMediaUploadBusy } from '@klnap/payload-storage-sanity/admin'

if (typeof isMediaUploadBusy !== 'function') {
  throw new Error('smoke: isMediaUploadBusy missing')
}
