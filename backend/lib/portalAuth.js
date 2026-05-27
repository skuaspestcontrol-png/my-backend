const crypto = require('crypto');

const DEFAULT_COOKIE_NAME = 'skuas_portal_session';
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

const parseCookies = (cookieHeader = '') => {
  return String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=');
      if (index < 0) return acc;
      const key = decodeURIComponent(part.slice(0, index).trim());
      const value = decodeURIComponent(part.slice(index + 1).trim());
      if (key) acc[key] = value;
      return acc;
    }, {});
};

const base64Url = (value) => Buffer.from(String(value), 'utf8').toString('base64url');

const signToken = (payload, secret) => {
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', String(secret || '')).update(body).digest('base64url');
  return `${body}.${signature}`;
};

const verifyToken = (token, secret) => {
  const rawToken = String(token || '').trim();
  const rawSecret = String(secret || '').trim();
  if (!rawToken || !rawSecret) return null;

  const [body, signature] = rawToken.split('.');
  if (!body || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', rawSecret).update(body).digest('base64url');
  const left = Buffer.from(signature, 'utf8');
  const right = Buffer.from(expectedSignature, 'utf8');
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    if (Number.isFinite(Number(payload.exp)) && Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch (_error) {
    return null;
  }
};

const buildPortalUser = (source = {}) => ({
  id: String(source.id || source.userId || source.employeeId || source.sub || '').trim(),
  role: String(source.role || 'Employee').trim(),
  name: String(source.name || source.userName || source.employeeName || 'User').trim(),
  employeeId: String(source.employeeId || source.id || source.sub || '').trim(),
  employeeCode: String(source.employeeCode || '').trim(),
  type: String(source.type || 'employee').trim(),
});

const createPortalSession = ({ user, secret, ttlMs = DEFAULT_TTL_MS }) => {
  const now = Date.now();
  const payload = {
    ...buildPortalUser(user),
    iat: now,
    exp: now + Math.max(60 * 1000, Number(ttlMs) || DEFAULT_TTL_MS)
  };
  return signToken(payload, secret);
};

const readPortalUserFromRequest = (req, { secret, cookieName = DEFAULT_COOKIE_NAME } = {}) => {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const token = String(
    cookies[cookieName]
    || req?.headers?.authorization?.replace(/^Bearer\s+/i, '')
    || ''
  ).trim();
  const payload = verifyToken(token, secret);
  return payload ? buildPortalUser(payload) : null;
};

const buildPortalAuthCookie = (token, {
  cookieName = DEFAULT_COOKIE_NAME,
  maxAgeMs = DEFAULT_TTL_MS,
  domain = '',
  secure = false,
  sameSite = 'Lax',
  path = '/'
} = {}) => {
  const parts = [
    `${cookieName}=${encodeURIComponent(String(token || '').trim())}`,
    `Path=${path}`,
    `Max-Age=${Math.max(60, Math.floor(Number(maxAgeMs || DEFAULT_TTL_MS) / 1000))}`,
    'HttpOnly',
    `SameSite=${sameSite}`
  ];
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
};

const buildClearPortalAuthCookie = (cookieName = DEFAULT_COOKIE_NAME, domain = '') => {
  const parts = [
    `${cookieName}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
};

module.exports = {
  DEFAULT_COOKIE_NAME,
  DEFAULT_TTL_MS,
  parseCookies,
  signToken,
  verifyToken,
  buildPortalUser,
  createPortalSession,
  readPortalUserFromRequest,
  buildPortalAuthCookie,
  buildClearPortalAuthCookie
};
