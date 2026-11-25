export default {
  containerName: 'payload-storage-sanity-test-db',
  envVar: 'PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL',
  image: 'postgres:16-alpine',
  cleanupDelayMs: 750,
  failIfUnavailableInCI: true,
}
