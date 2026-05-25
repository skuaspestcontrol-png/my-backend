const crypto = require('crypto');

const SECRET_PREFIX = 'enc:v1:';

const normalizeKey = (raw) => {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (/^[0-9a-fA-F]{64}$/.test(text)) {
    return Buffer.from(text, 'hex');
  }
  if (/^[A-Za-z0-9+/=]+$/.test(text)) {
    try {
      const decoded = Buffer.from(text, 'base64');
      if (decoded.length === 32) return decoded;
    } catch (_error) {}
  }
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length === 32) return buffer;
  return crypto.createHash('sha256').update(buffer).digest();
};

const resolveSecretKey = (envValue) => {
  const key = normalizeKey(envValue);
  if (key) return key;
  return null;
};

const isEncryptedSecret = (value) => String(value || '').startsWith(SECRET_PREFIX);

const encryptSecret = (plain, rawKey) => {
  const text = String(plain ?? '').trim();
  if (!text) return '';
  if (isEncryptedSecret(text)) return text;
  const key = resolveSecretKey(rawKey);
  if (!key) throw new Error('Secret encryption key is missing');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SECRET_PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

const decryptSecret = (payload, rawKey) => {
  const text = String(payload ?? '').trim();
  if (!text) return '';
  if (!isEncryptedSecret(text)) return text;
  const key = resolveSecretKey(rawKey);
  if (!key) throw new Error('Secret encryption key is missing');
  const encoded = text.slice(SECRET_PREFIX.length);
  const [ivB64, tagB64, dataB64] = encoded.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
};

module.exports = {
  SECRET_PREFIX,
  normalizeKey,
  resolveSecretKey,
  isEncryptedSecret,
  encryptSecret,
  decryptSecret
};
