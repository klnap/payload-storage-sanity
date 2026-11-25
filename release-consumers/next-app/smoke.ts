import { createSanityImageLoader } from '@klnap/payload-storage-sanity/next'
import loader from '@klnap/payload-storage-sanity/next/loader'

const fromNext = createSanityImageLoader()
const fromDefault = loader

if (typeof fromNext !== 'function' || typeof fromDefault !== 'function') {
  throw new Error('smoke: loader exports must be functions')
}

const listener = Bun.listen({
  hostname: '127.0.0.1',
  port: 0,
  socket: { data() {} },
})
const port = listener.port
listener.stop(true)

const server = Bun.spawn(
  [
    process.execPath,
    '--bun',
    'node_modules/next/dist/bin/next',
    'start',
    '-H',
    '127.0.0.1',
    '-p',
    String(port),
  ],
  { stdout: 'inherit', stderr: 'inherit' }
)
try {
  let html: string | undefined
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error(`Next exited with ${server.exitCode}`)
    const response = await fetch(`http://127.0.0.1:${port}`, {
      signal: AbortSignal.timeout(2_000),
    }).catch(() => undefined)
    if (response?.ok) {
      html = await response.text()
      break
    }
    if (response) throw new Error(`Built consumer returned HTTP ${response.status}`)
    await Bun.sleep(250)
  }
  if (!html?.includes('next release consumer') || !html.includes('alt="Example"')) {
    throw new Error('Built consumer did not render the installed Sanity image component')
  }
} finally {
  server.kill()
  await server.exited
}
