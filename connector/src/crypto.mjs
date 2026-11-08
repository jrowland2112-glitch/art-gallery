const encoder = new TextEncoder();

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64ToBytes(value) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

function hexToBytes(value) {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2) return new Uint8Array();
  return Uint8Array.from(value.match(/../g), (pair) => Number.parseInt(pair, 16));
}

export function constantTimeEqual(left, right) {
  const a = left instanceof Uint8Array ? left : new Uint8Array(left);
  const b = right instanceof Uint8Array ? right : new Uint8Array(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % Math.max(a.length, 1)] || 0) ^ (b[index % Math.max(b.length, 1)] || 0);
  }
  return difference === 0;
}

export async function hmac(secret, message) {
  if (!secret) throw new Error('A signing secret is required.');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

export async function verifyShopifyHmac(rawBody, header, secret) {
  if (!header || !secret) return false;
  return constantTimeEqual(await hmac(secret, rawBody), base64ToBytes(header));
}

export async function verifyWhccSignature(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 7 * 24 * 60 * 60) {
  if (!header || !secret) return false;
  const parts = header.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!/^\d+$/.test(timestamp || '') || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) return false;
  const expected = await hmac(secret, `${timestamp}.${rawBody}`);
  return signatures.some((signature) => constantTimeEqual(expected, hexToBytes(signature)));
}

export async function signAsset(key, expires, secret) {
  if (!key || !expires || !secret) throw new Error('The private-asset signing configuration is incomplete.');
  const digest = await hmac(secret, `${key}\n${expires}`);
  return bytesToBase64(digest).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function verifyAssetSignature(key, expires, signature, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!key || !signature || !/^\d+$/.test(String(expires)) || Number(expires) < nowSeconds) return false;
  const expected = await signAsset(key, expires, secret);
  return constantTimeEqual(encoder.encode(expected), encoder.encode(signature));
}
