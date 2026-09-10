const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const isHash = value => /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(String(value || ''));
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 256) {
    const error = new Error('Password must be between 10 and 256 characters');
    error.status = 400;
    throw error;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 32, options);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  if (!password || !stored || password.length > 256) return false;
  if (isHash(stored)) {
    const [, salt, expected] = stored.split('$');
    const actual = await scrypt(password, salt, 32, options);
    return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  }
  // Legacy credentials remain usable until explicitly changed; never return them to clients.
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(password).digest(), crypto.createHash('sha256').update(String(stored)).digest());
}
module.exports = { hashPassword, verifyPassword, isHash };
