const crypto = require('crypto');
const { db } = require('./_firebase');
const { signAdminToken, requireAdmin } = require('./_adminAuth');

const settingsDoc = () => db.collection('config').doc('settings');
const roomDoc = () => db.collection('config').doc('room');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // GET — public settings (no auth needed)
  if (req.method === 'GET') {
    const [settingsSnap, roomSnap] = await Promise.all([
      settingsDoc().get(),
      roomDoc().get(),
    ]);
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const roomInfo = roomSnap.exists ? roomSnap.data() : {};

    const tournamentsSnap = await db.collection('tournaments').get();
    const tournaments = tournamentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const announcementsSnap = await db.collection('announcements').orderBy('createdAt', 'desc').get();
    const announcements = announcementsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return res.status(200).json({
      entryFee: settings.entryFee || 99,
      upiId: settings.upiId || '',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_MOCK',
      mockMode: !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_MOCK',
      whatsappLink: settings.whatsappLink || '',
      roomInfo,
      tournaments,
      announcements,
    });
  }

  // POST — admin operations
  if (req.method === 'POST') {
    const { type } = req.body;

    // Admin login — no token required (this is how you get one)
    if (type === 'adminLogin') {
      const { password } = req.body;
      const settingsSnap = await settingsDoc().get();
      const settings = settingsSnap.exists ? settingsSnap.data() : {};

      if (!settings.adminPasswordHash) {
        return res.status(500).json({ error: 'Admin not configured. Run setup first.' });
      }

      const hash = crypto.pbkdf2Sync(password, settings.adminSalt, 10000, 64, 'sha512').toString('hex');
      if (hash !== settings.adminPasswordHash) {
        return res.status(401).json({ error: 'Wrong password' });
      }

      const token = signAdminToken(settings.adminEmail || 'admin');
      return res.status(200).json({ success: true, adminToken: token });
    }

    // All other POST operations require admin auth
    const adminUser = requireAdmin(req);
    if (!adminUser) {
      return res.status(401).json({ error: 'Unauthorized — admin login required' });
    }

    if (type === 'payment') {
      const update = {};
      if (req.body.entryFee) update.entryFee = parseInt(req.body.entryFee);
      if (req.body.upiId) update.upiId = req.body.upiId;
      await settingsDoc().set(update, { merge: true });
      return res.status(200).json({ success: true });
    }

    if (type === 'whatsapp') {
      if (req.body.whatsappLink) {
        await settingsDoc().set({ whatsappLink: req.body.whatsappLink }, { merge: true });
      }
      return res.status(200).json({ success: true });
    }

    if (type === 'room') {
      await roomDoc().set({
        roomId: req.body.roomId || '',
        roomPass: req.body.roomPass || '',
        roomMessage: req.body.roomMessage || '',
      });
      return res.status(200).json({ success: true });
    }

    if (type === 'clearRoom') {
      await roomDoc().set({ roomId: '', roomPass: '', roomMessage: '' });
      return res.status(200).json({ success: true });
    }

    if (type === 'addTournament') {
      const t = {
        name: req.body.name || 'Untitled',
        mode: req.body.mode || 'Squad',
        perspective: req.body.perspective || 'TPP',
        entryFee: parseInt(req.body.entryFee) || 99,
        teamSize: parseInt(req.body.teamSize) || 4,
        maps: req.body.maps || [],
        matches: parseInt(req.body.matches) || 1,
        time: req.body.time || '9:00 PM',
        prizes: req.body.prizes || [],
        status: req.body.status || 'active',
        createdAt: Date.now(),
      };
      const docRef = await db.collection('tournaments').add(t);
      return res.status(201).json({ success: true, tournament: { id: docRef.id, ...t } });
    }

    if (type === 'updateTournament') {
      const ref = db.collection('tournaments').doc(req.body.id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Not found' });
      const update = {};
      ['name','mode','perspective','time','status'].forEach(k => { if (req.body[k]) update[k] = req.body[k]; });
      ['entryFee','teamSize','matches'].forEach(k => { if (req.body[k]) update[k] = parseInt(req.body[k]); });
      if (req.body.maps) update.maps = req.body.maps;
      if (req.body.prizes) update.prizes = req.body.prizes;
      await ref.update(update);
      return res.status(200).json({ success: true });
    }

    if (type === 'deleteTournament') {
      await db.collection('tournaments').doc(req.body.id).delete();
      return res.status(200).json({ success: true });
    }

    if (type === 'addAnnouncement') {
      const text = (req.body.text || '').trim();
      if (!text) return res.status(400).json({ error: 'Text required' });
      const a = {
        text,
        date: new Date().toISOString().split('T')[0],
        pinned: !!req.body.pinned,
        createdAt: Date.now(),
      };
      const docRef = await db.collection('announcements').add(a);
      return res.status(201).json({ success: true, announcement: { id: docRef.id, ...a } });
    }

    if (type === 'deleteAnnouncement') {
      await db.collection('announcements').doc(req.body.id).delete();
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown type' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
