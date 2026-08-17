import { decode, encode } from "cbor2";

async function getCryptoKey(password: string) {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(password);
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
}

async function deriveKey(password: string, salt: Uint8Array) {
  const keyMaterial = await getCryptoKey(password);

  const buffer = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength
  ) as ArrayBuffer;

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: buffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

type EncryptedPayload = {
  cipherText: Uint8Array,
  iv: Uint8Array,
  salt: Uint8Array
};

 export async function encrypt(data: Uint8Array, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    buffer
  );

  const payload: EncryptedPayload = {
    cipherText: new Uint8Array(encrypted),
    iv: iv,
    salt: salt
  };

  return encode(payload);
}


export async function decrypt(encryptedData: Uint8Array, password: string) {
  const { cipherText, iv, salt } = decode<EncryptedPayload>(encryptedData);
  const key = await deriveKey(password, salt);

  const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const cipherTextBuffer = cipherText.buffer.slice(cipherText.byteOffset, cipherText.byteOffset + cipherText.byteLength) as ArrayBuffer;

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    cipherTextBuffer
  );

  return decrypted;
}

