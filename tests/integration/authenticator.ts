/**
 * Minimal software passkey (ES256, "none" attestation) for integration tests.
 * Produces real WebAuthn registration/assertion responses that the Worker
 * verifies with the same code path real browsers use.
 */
const subtle = crypto.subtle;

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

// --- tiny CBOR encoder (ints, byte/text strings, maps) ---
function head(major: number, n: number): number[] {
  if (n < 24) return [(major << 5) | n];
  if (n < 256) return [(major << 5) | 24, n];
  if (n < 65536) return [(major << 5) | 25, n >> 8, n & 255];
  return [(major << 5) | 26, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}
type Cbor = number | string | Uint8Array | Map<Cbor, Cbor>;
function cbor(v: Cbor): number[] {
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') {
    const b = new TextEncoder().encode(v);
    return [...head(3, b.length), ...b];
  }
  if (v instanceof Uint8Array) return [...head(2, v.length), ...v];
  const out = head(5, v.size);
  for (const [k, val] of v) out.push(...cbor(k), ...cbor(val));
  return out;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>));
}

/** Convert a raw (r||s) P-256 signature to ASN.1 DER, as WebAuthn requires. */
function derSignature(raw: Uint8Array): Uint8Array {
  const int = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let v = b.slice(i);
    if (v[0]! & 0x80) v = Uint8Array.from([0, ...v]);
    return [0x02, v.length, ...v];
  };
  const r = int(raw.slice(0, 32));
  const s = int(raw.slice(32));
  return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]);
}

export class SoftAuthenticator {
  credentialId = crypto.getRandomValues(new Uint8Array(16));
  counter = 0;
  userHandle: string | null = null;
  private keys!: CryptoKeyPair;

  constructor(
    readonly origin: string,
    readonly rpId: string,
    readonly opts: { userVerified?: boolean; countSignatures?: boolean } = {},
  ) {}

  private flags(attested: boolean): number {
    let f = 0x01; // UP
    if (this.opts.userVerified !== false) f |= 0x04; // UV
    if (attested) f |= 0x40; // AT
    return f;
  }

  private counterBytes(): number[] {
    const c = this.opts.countSignatures ? this.counter : 0;
    return [(c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255, c & 255];
  }

  async register(options: { challenge: string; user: { id: string } }, originOverride?: string) {
    this.keys = (await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = (await subtle.exportKey('jwk', this.keys.publicKey)) as JsonWebKey;
    const cose = new Map<Cbor, Cbor>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x!, 'base64url')],
      [-3, Buffer.from(jwk.y!, 'base64url')],
    ]);
    this.userHandle = options.user.id;
    const rpIdHash = await sha256(new TextEncoder().encode(this.rpId));
    const authData = Uint8Array.from([
      ...rpIdHash,
      this.flags(true),
      ...this.counterBytes(),
      ...new Uint8Array(16), // AAGUID
      0,
      this.credentialId.length,
      ...this.credentialId,
      ...cbor(cose),
    ]);
    const attestationObject = Uint8Array.from(
      cbor(new Map<Cbor, Cbor>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]])),
    );
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin: originOverride ?? this.origin, crossOrigin: false }),
    );
    const id = b64url(this.credentialId);
    return {
      id,
      rawId: id,
      type: 'public-key',
      response: { clientDataJSON: b64url(clientDataJSON), attestationObject: b64url(attestationObject), transports: ['internal'] },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }

  async assert(options: { challenge: string }) {
    this.counter++;
    const rpIdHash = await sha256(new TextEncoder().encode(this.rpId));
    const authenticatorData = Uint8Array.from([...rpIdHash, this.flags(false), ...this.counterBytes()]);
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin: this.origin, crossOrigin: false }),
    );
    const signed = Uint8Array.from([...authenticatorData, ...(await sha256(clientDataJSON))]);
    const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, this.keys.privateKey, signed));
    const id = b64url(this.credentialId);
    return {
      id,
      rawId: id,
      type: 'public-key',
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authenticatorData),
        signature: b64url(derSignature(raw)),
        userHandle: this.userHandle ?? undefined,
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }
}
