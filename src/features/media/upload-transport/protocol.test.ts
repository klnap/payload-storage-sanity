import { describe, expect, test } from 'bun:test'
import {
  SANITY_UPLOAD_PROTOCOL_VERSION,
  signSanityUploadReceipt,
  signSanityUploadTicket,
  verifySanityUploadReceipt,
  verifySanityUploadTicket,
} from './protocol'

const secret = 'a test secret with at least thirty-two bytes'
const ticketClaims = {
  audience: 'https://uploads.example.test/v1',
  claimEndpoint: 'https://payload.example.test/api/sanity-upload/claims',
  collection: 'media',
  dataset: 'production',
  documentId: 'media-1',
  expiresAt: 2_000,
  filename: 'video.mp4',
  issuedAt: 1_000,
  mimeType: 'video/mp4',
  maxSize: 1_000,
  nonce: 'session-1',
  operation: 'update' as const,
  projectId: 'project',
  size: 100,
  subject: 'user-1',
  version: SANITY_UPLOAD_PROTOCOL_VERSION,
}

describe('upload protocol', () => {
  test('signs and verifies a ticket with operation claims and audience', async () => {
    const ticket = await signSanityUploadTicket(ticketClaims, secret)
    expect(
      await verifySanityUploadTicket(ticket.token, secret, {
        audience: ticketClaims.audience,
        now: 1_500,
      })
    ).toEqual(ticketClaims)
  })

  test('rejects ticket tampering, audience mismatch, and expiry', async () => {
    const ticket = await signSanityUploadTicket(ticketClaims, secret)
    await expect(verifySanityUploadTicket(`${ticket.token}x`, secret)).rejects.toThrow()
    await expect(
      verifySanityUploadTicket(ticket.token, secret, { audience: 'https://other.test' })
    ).rejects.toThrow('Upload ticket audience mismatch.')
    await expect(
      verifySanityUploadTicket(ticket.token, secret, { now: ticketClaims.expiresAt })
    ).rejects.toThrow('Upload ticket has expired.')
  })

  test('signs and verifies transport receipts and rejects a different signing secret', async () => {
    const receiptClaims = {
      assetId: 'file-asset-123',
      audience: ticketClaims.audience,
      dataset: ticketClaims.dataset,
      filename: ticketClaims.filename,
      issuedAt: 1_500,
      mimeType: ticketClaims.mimeType,
      nonce: ticketClaims.nonce,
      projectId: ticketClaims.projectId,
      size: ticketClaims.size,
      version: SANITY_UPLOAD_PROTOCOL_VERSION,
    }
    const receipt = await signSanityUploadReceipt(receiptClaims, secret)
    expect(
      await verifySanityUploadReceipt(receipt.token, secret, {
        audience: ticketClaims.audience,
        now: 1_500,
      })
    ).toEqual(receiptClaims)
    await expect(verifySanityUploadReceipt(receipt.token, `${secret}x`)).rejects.toThrow(
      'Invalid upload token signature.'
    )
  })

  test('rejects malformed claims and short secrets', async () => {
    const ticket = await signSanityUploadTicket(ticketClaims, secret)
    await expect(verifySanityUploadTicket('not-a-valid-token', secret)).rejects.toThrow(
      'Invalid upload token format.'
    )
    await expect(signSanityUploadTicket(ticketClaims, 'short')).rejects.toThrow(
      'Upload transport secret must be at least 32 UTF-8 bytes.'
    )
    await expect(
      verifySanityUploadTicket(ticket.token, secret, { now: ticketClaims.expiresAt + 1 })
    ).rejects.toThrow('Upload ticket has expired.')
  })
})
