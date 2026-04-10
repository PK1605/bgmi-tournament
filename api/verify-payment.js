const crypto = require('crypto');
const { db } = require('./_firebase');
const { sendTemplateMessage } = require('./_whatsapp');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, registrationId } = req.body;

    if (!registrationId) {
      return res.status(400).json({ error: 'Missing registrationId' });
    }

    const ref = db.collection('registrations').doc(registrationId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Registration not found' });

    const regData = snap.data();
    const MOCK_MODE = !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_ID === 'rzp_test_MOCK';

    if (MOCK_MODE) {
      await ref.update({
        paymentStatus: 'verified',
        txnId: razorpay_payment_id || 'mock_pay_' + Date.now(),
      });
    } else {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        await ref.update({ paymentStatus: 'failed' });
        return res.status(400).json({ verified: false, error: 'Payment verification failed' });
      }

      await ref.update({ paymentStatus: 'verified', txnId: razorpay_payment_id });
    }

    // Send WhatsApp payment confirmation (non-blocking)
    if (regData.leaderWhatsApp) {
      const fee = regData.entryFee || 99;
      const tournamentName = regData.tournamentDate
        ? 'Scrims ' + regData.tournamentDate
        : 'Tournament';
      sendTemplateMessage(
        regData.leaderWhatsApp,
        'payment_confirmed',
        [String(fee), tournamentName, regData.teamName || 'Team']
      ).catch(() => {});
    }

    const [settingsSnap, roomSnap] = await Promise.all([
      db.collection('config').doc('settings').get(),
      db.collection('config').doc('room').get(),
    ]);
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const roomInfo = roomSnap.exists ? roomSnap.data() : {};

    const updatedSnap = await ref.get();
    return res.status(200).json({
      verified: true,
      registration: { id: updatedSnap.id, ...updatedSnap.data() },
      whatsappLink: settings.whatsappLink || '',
      roomInfo,
    });

  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
