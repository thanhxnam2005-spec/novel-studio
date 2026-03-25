// ─── Password-based Encryption (Web Crypto API) ─────────────

export interface EncryptedPayload {
  encrypted: true;
  algorithm: "AES-GCM";
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

const PBKDF2_ITERATIONS = 600_000;

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array(salt).buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptData(
  data: string,
  password: string,
): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    new TextEncoder().encode(data),
  );

  return {
    encrypted: true,
    algorithm: "AES-GCM",
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

export async function decryptData(
  payload: EncryptedPayload,
  password: string,
): Promise<string> {
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);
  const key = await deriveKey(password, salt);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("Mật khẩu không đúng.");
  }
}

export function isEncryptedPayload(data: unknown): data is EncryptedPayload {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.encrypted === true &&
    typeof obj.salt === "string" &&
    typeof obj.iv === "string" &&
    typeof obj.ciphertext === "string"
  );
}
