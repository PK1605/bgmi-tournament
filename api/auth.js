const crypto = require('crypto');
const { db } = require('./_firebase');

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
  const usersRef = db.collection('users');

  if (action === 'signup') {
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name is required (min 2 chars)' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const snap = await usersRef.where('email', '==', emailLower).limit(1).get();
    if (!snap.empty) {
      return res.status(409).json({ error: 'Account already exists. Please sign in.' });
    }

    const { salt, hash } = hashPassword(password);
    const token = generateToken();
    const user = {
      name: name.trim(),
      email: emailLower,
      passwordHash: hash,
      salt,
      token,
      createdAt: new Date().toISOString(),
    };

    const docRef = await usersRef.add(user);

    return res.status(201).json({
      success: true,
      user: { id: docRef.id, name: user.name, email: user.email, token },
    });
  }

  if (action === 'signin') {
    const snap = await usersRef.where('email', '==', emailLower).limit(1).get();
    if (snap.empty) {
      return res.status(401).json({ error: 'Account not found. Please sign up first.' });
    }

    const doc = snap.docs[0];
    const userData = doc.data();
    const { hash } = hashPassword(password, userData.salt);

    if (hash !== userData.passwordHash) {
      return res.status(401).json({ error: 'Wrong password. Try again.' });
    }

    const token = generateToken();
    await doc.ref.update({ token });

    return res.status(200).json({
      success: true,
      user: { id: doc.id, name: userData.name, email: userData.email, token },
    });
  }

  if (action === 'verify') {
    const { token } = req.body;
    const snap = await usersRef
      .where('email', '==', emailLower)
      .where('token', '==', token)
      .limit(1).get();

    if (snap.empty) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    const userData = snap.docs[0].data();
    return res.status(200).json({
      success: true,
      user: { id: snap.docs[0].id, name: userData.name, email: userData.email },
    });
  }

  return res.status(400).json({ error: 'Invalid action' });
};
