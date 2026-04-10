const { db } = require('./_firebase');
const { requireAdmin } = require('./_adminAuth');
const { sendTemplateMessage, sendTextMessage, isConfigured } = require('./_whatsapp');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const adminUser = requireAdmin(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized — admin login required' });
  }

  if (!isConfigured()) {
    return res.status(400).json({ error: 'WhatsApp API not configured. Set WA_PHONE_NUMBER_ID and WA_ACCESS_TOKEN in env.' });
  }

  const { type, tournamentId } = req.body;

  if (!tournamentId) {
    return res.status(400).json({ error: 'tournamentId required' });
  }

  const regsSnap = await db.collection('registrations')
    .where('tournamentId', '==', tournamentId)
    .where('paymentStatus', '==', 'verified')
    .get();

  if (regsSnap.empty) {
    return res.status(200).json({ success: true, sent: 0, failed: 0, total: 0, message: 'No verified registrations found' });
  }

  const registrations = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  let sent = 0;
  let failed = 0;

  if (type === 'room') {
    const roomSnap = await db.collection('config').doc('room').get();
    const room = roomSnap.exists ? roomSnap.data() : {};

    if (!room.roomId) {
      return res.status(400).json({ error: 'Set Room ID first before broadcasting' });
    }

    const schedule = req.body.schedule || room.roomMessage || '';

    for (const reg of registrations) {
      if (!reg.leaderWhatsApp) { failed++; continue; }
      const result = await sendTemplateMessage(
        reg.leaderWhatsApp,
        'room_details',
        [room.roomId, room.roomPass || '', schedule]
      );
      if (result.success) sent++;
      else failed++;
    }

    return res.status(200).json({ success: true, sent, failed, total: registrations.length });
  }

  if (type === 'custom') {
    const message = (req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Message text required' });
    }

    for (const reg of registrations) {
      if (!reg.leaderWhatsApp) { failed++; continue; }
      const result = await sendTextMessage(reg.leaderWhatsApp, message);
      if (result.success) sent++;
      else failed++;
    }

    return res.status(200).json({ success: true, sent, failed, total: registrations.length });
  }

  return res.status(400).json({ error: 'Unknown type. Use "room" or "custom".' });
};
