const crypto = require('crypto');
const { signToken, verifyToken } = require('./portalAuth');
const shareKey = () => {
  const secret = String(process.env.PORTAL_AUTH_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || '').trim();
  if (secret.length < 32) return '';
  return crypto.createHmac('sha256', secret).update('document-sharing-v1').digest('hex');
};
const allowedPath = value => /^\/api\/(?:service-visits\/[^/]+\/job-card-pdf|jobs\/[^/]+\/pdf|payroll\/items\/[^/]+\/slip\/pdf)$/.test(value);
function createDocumentShare(origin, pathname, employeeId = 'document-recipient') {
  const key = shareKey();
  if (!key || !allowedPath(pathname)) throw new Error('Document sharing is not configured');
  const now = Date.now();
  const token = signToken({ id: employeeId, employeeId, role: 'Employee', path: pathname, iat: now, exp: now + 60 * 60 * 1000 }, key);
  const url = new URL(pathname, origin);
  url.searchParams.set('share', token);
  return url.toString();
}
function readDocumentShare(req) {
  if (!['GET', 'HEAD'].includes(req.method) || !allowedPath(req.path)) return null;
  const payload = verifyToken(req.query?.share, shareKey());
  return payload?.path === req.path ? payload : null;
}
module.exports = { createDocumentShare, readDocumentShare };
