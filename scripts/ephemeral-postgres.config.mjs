export default {
  containerName: 'payload-storage-sanity-test-db',
  envVar: 'PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL',
  // Same pinned image as the redirect package and its CI service container: one server version everywhere.
  image:
    'postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea',
  cleanupDelayMs: 750,
}
