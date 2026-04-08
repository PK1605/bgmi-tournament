const crypto = require('crypto');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev_secret_change_me';

function signAdminToken(email) {
  const payload = email + ':' + Date.now();
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
  return Buffer.from(payload + ':' + sig).toString('base64');
}

function verifyAdminToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length < 3) return null;
    const sig = parts.pop();
    const payload = parts.join(':');
    const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
    if (sig !== expected) return null;
    const [email] = payload.split(':');
    return { email };
  } catch {
    return null;
  }
}

function requireAdmin(req) {
  const auth = req.headers?.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  return verifyAdminToken(token);
}

module.exports = { signAdminToken, verifyAdminToken, requireAdmin };
