/**
 * Minimal Web Push sender for Cloudflare Workers / Node, using Web Crypto.
 * Sends VAPID-authenticated push requests with optional aes128gcm payload encryption.
 *
 * Reference: RFC 8030 (Web Push), RFC 8291 (encryption), RFC 8292 (VAPID).
 */

// VAPID keys must be supplied via environment variables. The private key is
// security-sensitive — never hardcode a fallback in source.
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@quottr.app";

function assertVapidConfigured() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("VAPID keys are not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
  }
}

// ---------------- base64url helpers ----------------
function b64uToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "====".slice(s.length % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// ---------------- VAPID JWT (ES256) ----------------
async function importVapidPrivateKey(): Promise<CryptoKey> {
  // Build JWK from the public (uncompressed) + private d
  const pub = b64uToBytes(VAPID_PUBLIC_KEY);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("Bad VAPID public key");
  const x = bytesToB64u(pub.slice(1, 33));
  const y = bytesToB64u(pub.slice(33, 65));
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", x, y, d: VAPID_PRIVATE_KEY, ext: true };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function signVapidJwt(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  };
  const enc = new TextEncoder();
  const head64 = bytesToB64u(enc.encode(JSON.stringify(header)));
  const pay64 = bytesToB64u(enc.encode(JSON.stringify(payload)));
  const data = enc.encode(`${head64}.${pay64}`);
  const key = await importVapidPrivateKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data),
  );
  return `${head64}.${pay64}.${bytesToB64u(sig)}`;
}

// ---------------- aes128gcm payload encryption (RFC 8291) ----------------
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource } as HkdfParams,
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function encryptPayload(
  payload: Uint8Array,
  uaPublicRaw: Uint8Array,
  authSecret: Uint8Array,
): Promise<{ body: Uint8Array; asPublic: Uint8Array }> {
  // 1. Generate ephemeral ECDH keypair (application server)
  const asKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const asPublicJwk = await crypto.subtle.exportKey("jwk", asKeyPair.publicKey);
  const asPublic = concat(
    new Uint8Array([0x04]),
    b64uToBytes(asPublicJwk.x!),
    b64uToBytes(asPublicJwk.y!),
  );

  // 2. Import UA public key
  const uaJwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    x: bytesToB64u(uaPublicRaw.slice(1, 33)),
    y: bytesToB64u(uaPublicRaw.slice(33, 65)),
    ext: true,
  };
  const uaPubKey = await crypto.subtle.importKey(
    "jwk", uaJwk, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  // 3. ECDH shared secret
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPubKey }, asKeyPair.privateKey, 256),
  );

  // 4. PRK_key = HKDF(auth_secret, ecdhSecret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const enc = new TextEncoder();
  const keyInfo = concat(
    enc.encode("WebPush: info\0"),
    uaPublicRaw,
    asPublic,
  );
  const ikmForPrk = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // 5. salt (16 bytes random)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 6. CEK and nonce via HKDF with the new salt
  const cek = await hkdf(salt, ikmForPrk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikmForPrk, enc.encode("Content-Encoding: nonce\0"), 12);

  // 7. Encrypt: payload || 0x02 (last record delimiter) per aes128gcm
  const plaintext = concat(payload, new Uint8Array([0x02]));
  const cekKey = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, cekKey, plaintext as BufferSource),
  );

  // 8. Build aes128gcm header: salt(16) || rs(4 BE = 4096) || idlen(1) || keyid(asPublic 65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);

  return { body: concat(header, ciphertext), asPublic };
}

// ---------------- Public API ----------------
export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string; // base64url, 65-byte uncompressed point
  auth: string; // base64url, 16 bytes
};

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

export async function sendWebPush(
  sub: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<{ status: number; ok: boolean }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signVapidJwt(audience);

  const headers: Record<string, string> = {
    TTL: "60",
    Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    Urgency: "high",
  };

  let body: BodyInit | undefined;
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  if (payloadBytes.length > 0) {
    const uaPub = b64uToBytes(sub.p256dh);
    const authSecret = b64uToBytes(sub.auth);
    const enc = await encryptPayload(payloadBytes, uaPub, authSecret);
    headers["Content-Encoding"] = "aes128gcm";
    headers["Content-Type"] = "application/octet-stream";
    headers["Content-Length"] = String(enc.body.length);
    body = enc.body as unknown as BodyInit;
  } else {
    headers["Content-Length"] = "0";
  }

  const resp = await fetch(sub.endpoint, { method: "POST", headers, body });
  return { status: resp.status, ok: resp.ok };
}
