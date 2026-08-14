import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const keyFromBase64 = (value: string): Buffer => {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY inválida');
  return key;
};

export function encryptSecret(value: string, keyBase64: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', keyFromBase64(keyBase64), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(value: string, keyBase64: string): string {
  const [version, iv, tag, payload] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !payload) throw new Error('Segredo criptografado inválido');
  const decipher = createDecipheriv('aes-256-gcm', keyFromBase64(keyBase64), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8');
}
