#!/usr/bin/env node
/**
 * Genera un par de claves VAPID para las push notifications (PWA).
 * Uso: node scripts/generate-vapid-keys.mjs
 * Copia la salida en .env.local y en las variables de entorno de Vercel.
 * OJO: NEXT_PUBLIC_VAPID_PUBLIC_KEY se inyecta en build → hay que redeployar.
 */
import crypto from 'node:crypto'

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ type: 'spki', format: 'der' }).subarray(26).toString('base64url')
const priv = privateKey.export({ format: 'jwk' }).d

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pub}`)
console.log(`VAPID_PRIVATE_KEY=${priv}`)
