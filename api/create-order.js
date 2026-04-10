const Razorpay = require('razorpay');
const { db } = require('./_firebase');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { teamName, teamTag, leaderName, leaderWhatsApp, leaderEmail, players, substitute, tournamentId, tournamentDate } = req.body;

    if (!teamName || !leaderEmail || !players || players.length < 4) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!tournamentId) {
      return res.status(400).json({ error: 'Please select a tournament' });
    }

    const emailLower = leaderEmail.toLowerCase();

    let existingQuery = db.collection('registrations')
      .where('leaderEmail', '==', emailLower)
      .where('tournamentId', '==', tournamentId);
    const existingSnap = await existingQuery.limit(1).get();

    if (!existingSnap.empty) {
      const existing = { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() };
      return res.status(200).json({
        existing: true,
        registration: existing,
        message: 'Already registered for this tournament',
      });
    }

    // Collect all BGMI IDs from submitted players (+ substitute if present)
    const allBgmiIds = players.map(p => p.bgmiId).filter(Boolean);
    const subId = (substitute && substitute.bgmiId) ? substitute.bgmiId : null;
    if (subId) allBgmiIds.push(subId);

    // --- BLACKLIST CHECK ---
    if (allBgmiIds.length) {
      const blacklistSnap = await db.collection('blacklist')
        .where('bgmiId', 'in', allBgmiIds).get();
      if (!blacklistSnap.empty) {
        const banned = blacklistSnap.docs[0].data();
        return res.status(403).json({
          error: 'Banned player detected',
          detail: 'Player ' + (banned.ign || '') + ' (BGMI ID: ' + banned.bgmiId + ') is banned: ' + (banned.reason || 'Cheating'),
          banned: true,
        });
      }
    }

    // --- DUPLICATE BGMI ID CHECK (same tournament) ---
    const tournamentRegsSnap = await db.collection('registrations')
      .where('tournamentId', '==', tournamentId).get();
    for (const doc of tournamentRegsSnap.docs) {
      const regData = doc.data();
      const existingIds = (regData.players || []).map(p => p.bgmiId);
      if (regData.substitute && regData.substitute.bgmiId) existingIds.push(regData.substitute.bgmiId);
      const overlap = allBgmiIds.filter(id => existingIds.includes(id));
      if (overlap.length) {
        return res.status(409).json({
          error: 'Duplicate BGMI ID in this tournament',
          detail: 'BGMI ID ' + overlap[0] + ' is already registered by team "' + (regData.teamName || '') + '"',
          duplicate: true,
        });
      }
    }

    const settingsSnap = await db.collection('config').doc('settings').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const amount = (settings.entryFee || 99) * 100;

    const MOCK_MODE = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_MOCK';

    let order;

    if (MOCK_MODE) {
      order = {
        id: 'order_mock_' + Date.now(),
        amount,
        currency: 'INR',
        status: 'created',
      };
    } else {
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      try {
        order = await razorpay.orders.create({
          amount,
          currency: 'INR',
          receipt: 'malwa_' + Date.now(),
          notes: { teamName, leaderEmail: emailLower },
        });
      } catch (rzpErr) {
        console.error('Razorpay API error:', rzpErr.statusCode, rzpErr.error || rzpErr.message);
        return res.status(502).json({
          error: 'Payment gateway error — check your Razorpay API keys',
          detail: rzpErr.error?.description || rzpErr.message,
        });
      }
    }

    const reg = {
      teamName,
      teamTag: teamTag || '',
      leaderName,
      leaderWhatsApp: leaderWhatsApp || '',
      leaderEmail: emailLower,
      players,
      substitute: substitute || { ign: '', bgmiId: '' },
      tournamentId: tournamentId || '',
      tournamentDate: tournamentDate || '',
      paymentStatus: 'pending',
      txnId: '',
      payNote: '',
      orderId: order.id,
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
    };

    const docRef = await db.collection('registrations').add(reg);

    return res.status(200).json({
      existing: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_MOCK',
      registration: { id: docRef.id, ...reg },
      mockMode: MOCK_MODE,
    });

  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
