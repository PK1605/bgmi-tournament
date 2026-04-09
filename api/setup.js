const crypto = require('crypto');
const { db } = require('./_firebase');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  let setupSecret, adminEmail, adminPassword;

  if (req.method === 'GET') {
    setupSecret = req.query.secret;
    adminEmail = req.query.adminEmail;
    adminPassword = req.query.adminPassword;
  } else if (req.method === 'POST') {
    setupSecret = (req.body || {}).setupSecret;
    adminEmail = (req.body || {}).adminEmail;
    adminPassword = (req.body || {}).adminPassword;
  } else {
    return res.status(405).json({ error: 'GET or POST only' });
  }

  const expected = process.env.SETUP_SECRET;
  if (!expected || setupSecret !== expected) {
    return res.status(403).json({ error: 'Invalid setup secret' });
  }

  if (!adminEmail || !adminPassword || adminPassword.length < 6) {
    return res.status(400).json({ error: 'adminEmail and adminPassword (min 6 chars) required' });
  }

  // Check if already set up
  const settingsRef = db.collection('config').doc('settings');
  const existing = await settingsRef.get();
  if (existing.exists && existing.data().adminPasswordHash) {
    return res.status(409).json({ error: 'Already set up. Delete settings doc to re-run.' });
  }

  // Hash admin password
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(adminPassword, salt, 10000, 64, 'sha512').toString('hex');

  // Seed settings
  await settingsRef.set({
    adminEmail: adminEmail.toLowerCase(),
    adminPasswordHash: hash,
    adminSalt: salt,
    entryFee: 99,
    upiId: '',
    whatsappLink: '',
    createdAt: new Date().toISOString(),
  });

  // Seed default room info
  await db.collection('config').doc('room').set({
    roomId: '',
    roomPass: '',
    roomMessage: '',
  });

  // Seed first tournament
  await db.collection('tournaments').add({
    name: 'Daily Squad Scrims',
    mode: 'Squad',
    perspective: 'TPP',
    entryFee: 99,
    teamSize: 4,
    maps: ['Erangel', 'Miramar', 'Rondo'],
    mapSchedule: [
      { matchNum: 1, map: 'Erangel', time: '9:00 PM', desc: 'Classic 8x8 — TPP Squad' },
      { matchNum: 2, map: 'Miramar', time: '9:30 PM', desc: 'Desert 8x8 — TPP Squad' },
      { matchNum: 3, map: 'Rondo', time: '10:00 PM', desc: 'Arena Map — TPP Squad' },
    ],
    matches: 3,
    time: '9:00 PM',
    prizes: [400, 250, 200, 150, 100],
    status: 'active',
    createdAt: Date.now(),
  });

  // Seed welcome announcement
  await db.collection('announcements').add({
    text: 'Welcome to Malwa Esports Season 1! Registrations are now open.',
    date: new Date().toISOString().split('T')[0],
    pinned: true,
    createdAt: Date.now(),
  });

  return res.status(201).json({
    success: true,
    message: 'Setup complete! Admin account created. You can now login at /admin.html',
  });
};
