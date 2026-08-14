import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
const parameters: { N: number; r: number; p: number; maxmem: number } = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const scrypt = (password: string, salt: Buffer, length: number, options: typeof parameters): Promise<Buffer> => new Promise((resolve, reject) => {
  nodeScrypt(password, salt, length, options, (error, derived) => error ? reject(error) : resolve(derived));
});

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 14 || password.length > 128) throw new Error('A senha deve ter entre 14 e 128 caracteres');
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, parameters);
  return `scrypt$${parameters.N}$${parameters.r}$${parameters.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltValue, hashValue] = encoded.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltValue || !hashValue || password.length > 128) return false;
  const expected = Buffer.from(hashValue, 'base64url');
  if (expected.length !== 64) return false;
  try {
    const derived = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: parameters.maxmem
    });
    return timingSafeEqual(derived, expected);
  } catch { return false; }
}
