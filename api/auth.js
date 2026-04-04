const crypto = require('crypto');
const store = require('./_store');

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action, email, password, name } = req.body || {};

  if (!action || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const emailLower = email.trim().toLowerCase();

  // ======================== SIGN UP ========================
  if (action === 'signup') {
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name is required (min 2 chars)' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const exists = store.users.find(u => u.email === emailLower);
    if (exists) {
      return res.status(409).json({ error: 'Account already exists. Please sign in.' });
    }

    const { salt, hash } = hashPassword(password);
    const token = generateToken();
    const user = {
      id: 'usr_' + Date.now(),
      name: name.trim(),
      email: emailLower,
      passwordHash: hash,
      salt,
      token,
      createdAt: new Date().toISOString(),
    };

    store.users.push(user);

    return res.status(201).json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, token },
    });
  }

  // ======================== SIGN IN ========================
  if (action === 'signin') {
    const user = store.users.find(u => u.email === emailLower);
    if (!user) {
      return res.status(401).json({ error: 'Account not found. Please sign up first.' });
    }

    const { hash } = hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return res.status(401).json({ error: 'Wrong password. Try again.' });
    }

    const token = generateToken();
    user.token = token;

    return res.status(200).json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, token },
    });
  }

  // ======================== VERIFY TOKEN ========================
  if (action === 'verify') {
    const { token } = req.body;
    const user = store.users.find(u => u.email === emailLower && u.token === token);
    if (!user) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(200).json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
    });
  }

  return res.status(400).json({ error: 'Invalid action' });
};
