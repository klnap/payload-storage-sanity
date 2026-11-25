#!/usr/bin/env bash
set -euo pipefail
tarball="$(realpath "$1")"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cd "$work"
cat > package.json <<'JSON'
{ "name": "consumer-smoke", "private": true, "type": "module" }
JSON
npm install --no-audit --no-fund \
  "$tarball" payload@3.94.1 @payloadcms/plugin-cloud-storage@3.94.1 \
  @payloadcms/ui@3.94.1 @payloadcms/translations@3.94.1 @payloadcms/db-sqlite@3.94.1 \
  @sanity/client@8.14.1 react@19.3.1 react-dom@19.3.1 graphql@16.15.0 next@16.4.6 >/dev/null
cat > smoke.ts <<'TS'
import assert from 'node:assert/strict'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { sanityStorage } from '@klnap/payload-storage-sanity'
import { buildConfig, getPayload } from 'payload'

const config = await buildConfig({
  secret: 'consumer-smoke-secret',
  db: sqliteAdapter({ client: { url: 'file:./smoke.db' } }),
  collections: [{ slug: 'media', upload: true, fields: [] }],
  plugins: [
    sanityStorage({
      projectId: 'fixture',
      dataset: 'production',
      token: 'fixture-token',
      collections: { media: true },
    }),
  ],
})
const payload = await getPayload({ config })
assert.ok(payload.collections.media.config.upload.disableLocalStorage)
await payload.destroy()
console.log('consumer smoke OK')
process.exit(0)
TS
bun run smoke.ts
