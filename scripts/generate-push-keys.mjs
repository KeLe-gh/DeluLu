import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
})

const key = privateKey.export({ format: 'jwk' })

const publicKey = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(key.x, 'base64url'),
    Buffer.from(key.y, 'base64url'),
]).toString('base64url')

writeFileSync(
    '.env.push.local',
    [
        'WEB_PUSH_PUBLIC_KEY=' + publicKey,
        'WEB_PUSH_PRIVATE_KEY=' + key.d,
        'PUSH_WORKER_SECRET=' +
        randomBytes(32).toString('base64url'),
        'WEB_PUSH_SUBJECT=https://delulu-delta.vercel.app',
        '',
    ].join('\n'),
    {
        flag: 'wx',
        mode: 0o600,
    },
)

console.log(
    'Private configuration saved in .env.push.local. Keep this file private.',
)

console.log('VITE_WEB_PUSH_PUBLIC_KEY=' + publicKey)