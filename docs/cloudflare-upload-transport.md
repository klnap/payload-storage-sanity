# Cloudflare upload transport

The optional Cloudflare Worker transport moves browser upload bytes directly to
Sanity. The default internal upload path remains unchanged. The transport
requires a transactional Payload database; PostgreSQL is the verified target.

## Initialize a Worker project

Run the CLI from the Payload application root:

```sh
bunx payload-storage-sanity init cloudflare
```

This creates `workers/payload-sanity-storage`. Use `--name` and `--dir` to
choose another Worker name or project directory. The generated entry imports
the Worker runtime from
`@klnap/payload-storage-sanity/cloudflare`; it does not copy package source.

From the generated project directory, install its dependencies:

```sh
cd workers/payload-sanity-storage
bun install
```

Set `account_id` in the generated `wrangler.jsonc`. For local development, put
`SANITY_TOKEN` and `UPLOAD_TRANSPORT_SECRET` in the generated project's ignored
`.dev.vars` file. `bun run dev` enables HTTP only for loopback Payload endpoints.
That development override is not included in deploy commands.

Set these secrets for the default, staging, and production Worker environments:

```sh
bunx wrangler secret put SANITY_TOKEN
bunx wrangler secret put UPLOAD_TRANSPORT_SECRET
bunx wrangler secret put SANITY_TOKEN --env staging
bunx wrangler secret put UPLOAD_TRANSPORT_SECRET --env staging
bunx wrangler secret put SANITY_TOKEN --env production
bunx wrangler secret put UPLOAD_TRANSPORT_SECRET --env production
```

The upload secret must match the Payload-side transport configuration:

```ts
import { sanityStorage } from '@klnap/payload-storage-sanity'
import { cloudflareTransport } from '@klnap/payload-storage-sanity/cloudflare-transport'

sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  upload: {
    transport: cloudflareTransport({
      workerUrl: process.env.SANITY_UPLOAD_WORKER_URL!,
      secret: process.env.SANITY_UPLOAD_SECRET!,
    }),
  },
})
```

## Deploy safely

Authenticate Wrangler with the intended Cloudflare account and set
`CLOUDFLARE_API_TOKEN` in the deploy process. This token needs read-only Workers
Scripts permission for the configured account. The guard uses it only to list
scripts; it is not a Worker secret. The guard strips it from Wrangler
subprocesses, and Wrangler's native login handles deployment.

Run `bun run deploy`, `bun run deploy:staging`, or
`bun run deploy:production`. The guard checks every page of the configured
account's Workers Scripts list. It refuses to adopt or overwrite an existing
name. When no matching script exists, it requires interactive confirmation of
the exact effective name before deployment.

The name check and deployment are not atomic. Another account actor could
create the name between the check and deployment; resolve any conflict with the
account owner before retrying.

## Upload boundaries

- Cloudflare remains optional. Internal uploads are still the default.
- Payload authorizes the upload and owns metadata, folder assignment, and
  document finalization. The Worker transfers bytes to the Sanity target bound
  by the signed ticket.
- REST, Local API, crop processing, and other server-side uploads remain on the
  internal path.
- Failed or interrupted transfers consume the claimed ticket. Request a new
  authorized ticket to retry. A Sanity asset accepted before a connection
  failure can remain unfinalized; the package does not delete it automatically.
- Sanity CDN URLs remain public. Payload access control does not revoke a known
  asset URL.

Live Cloudflare and Sanity account behavior requires disposable credentials and
was not verified for this implementation.
