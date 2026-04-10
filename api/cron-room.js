const { db } = require('./_firebase');
const { sendTemplateMessage, isConfigured } = require('./_whatsapp');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const secret = req.query.secret || req.headers['x-cron-secret'] || req.headers['authorization'];
  const expected = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  if (!isVercelCron && (!expected || secret !== expected)) {
    return res.status(403).json({ error: 'Invalid cron secret' });
  }

  if (!isConfigured()) {
    return res.status(200).json({ skipped: true, reason: 'WhatsApp not configured' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const nowMinutes = getNowMinutesIST();

  const tournamentsSnap = await db.collection('tournaments')
    .where('status', '==', 'active')
    .where('date', '==', todayStr)
    .get();

  if (tournamentsSnap.empty) {
    return res.status(200).json({ message: 'No active tournaments today' });
  }

  const roomSnap = await db.collection('config').doc('room').get();
  const room = roomSnap.exists ? roomSnap.data() : {};

  if (!room.roomId) {
    return res.status(200).json({ message: 'Room ID not set yet' });
  }

  let totalSent = 0;
  let totalFailed = 0;

  for (const doc of tournamentsSnap.docs) {
    const t = { id: doc.id, ...doc.data() };

    if (t.roomSent) continue;

    const matchTime = getFirstMatchTime(t);
    if (!matchTime) continue;

    const matchMinutes = parseTimeToMinutes(matchTime);
    if (matchMinutes === null) continue;

    const diff = matchMinutes - nowMinutes;

    // Send if within 15-25 min window (cron runs every 5 min, so 20 +/- 5 buffer)
    if (diff > 25 || diff < 0) continue;

    const regsSnap = await db.collection('registrations')
      .where('tournamentId', '==', t.id)
      .where('paymentStatus', '==', 'verified')
      .get();

    const schedule = (t.mapSchedule || []).map(m => m.map + ' @ ' + m.time).join(', ');

    for (const regDoc of regsSnap.docs) {
      const reg = regDoc.data();
      if (!reg.leaderWhatsApp) { totalFailed++; continue; }

      const result = await sendTemplateMessage(
        reg.leaderWhatsApp,
        'room_details',
        [room.roomId, room.roomPass || '', schedule || room.roomMessage || '']
      );
      if (result.success) totalSent++;
      else totalFailed++;
    }

    await doc.ref.update({ roomSent: true });
  }

  return res.status(200).json({
    success: true,
    sent: totalSent,
    failed: totalFailed,
    timestamp: new Date().toISOString(),
  });
};

function getFirstMatchTime(tournament) {
  if (tournament.mapSchedule && tournament.mapSchedule.length) {
    return tournament.mapSchedule[0].time;
  }
  return tournament.time || null;
}

function getNowMinutesIST() {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + istOffset) % (24 * 60);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}
