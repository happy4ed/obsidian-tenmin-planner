// UUID 도우미. 파일에는 원본 앱(Swift)처럼 대문자로 쓴다.
//
// carryTaskId(원래 id) = UUIDv5(이름공간 = 원래 할 일의 UUID, 이름 = "carry")   (RFC 9562, SHA-1)
// 같은 할 일을 → 로 넘기면 늘 같은 id 가 나와서, 두 사본을 합쳐도 넘긴 할 일이 하나다.
// 이 파일 형식을 읽고 쓰는 앱은 모두 이 규칙을 따른다 (원본 TaskIDs.swift).

export type UUID = string;

export function newUUID(): UUID {
  return crypto.randomUUID().toUpperCase();
}

export function sameUUID(a: UUID | null | undefined, b: UUID | null | undefined): boolean {
  if (a == null || b == null) return a == b;
  return a.toUpperCase() === b.toUpperCase();
}

function uuidBytes(u: UUID): Uint8Array {
  const hex = u.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error(`bad uuid: ${u}`);
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToUUID(b: Uint8Array): UUID {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** SHA-1 (동기). UUIDv5 에만 쓴다. */
export function sha1(msg: Uint8Array): Uint8Array {
  const ml = msg.length;
  const withOne = ml + 1;
  const total = Math.ceil((withOne + 8) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[ml] = 0x80;
  const view = new DataView(buf.buffer);
  const bits = ml * 8;
  view.setUint32(total - 8, Math.floor(bits / 0x100000000));
  view.setUint32(total - 4, bits >>> 0);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return out;
}

/** RFC 9562 이름 기반 UUID 버전 5 */
export function uuidV5(namespace: UUID, name: string): UUID {
  const ns = uuidBytes(namespace);
  const nm = new TextEncoder().encode(name);
  const msg = new Uint8Array(ns.length + nm.length);
  msg.set(ns);
  msg.set(nm, ns.length);
  const h = sha1(msg).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  return bytesToUUID(h);
}

/** → 로 다음 날에 넘긴 할 일(사본)의 id */
export function carryTaskId(originalId: UUID): UUID {
  return uuidV5(originalId, "carry");
}

/** RFC 9562 NameSpace_URL */
export const URL_NAMESPACE = "6BA7B811-9DAD-11D1-80B4-00C04FD430C8";
