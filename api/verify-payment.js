const crypto = require('crypto');
const store = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, registrationId } = req.body;

    if (!registrationId) {
      return res.status(400).json({ error: 'Missing registrationId' });
    }

    const reg = store.registrations.find(r => r.id === registrationId);
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    const MOCK_MODE = !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_ID === 'rzp_test_MOCK';

    if (MOCK_MODE) {
      reg.paymentStatus = 'verified';
      reg.txnId = razorpay_payment_id || 'mock_pay_' + Date.now();
      return res.status(200).json({
        verified: true,
        registration: reg,
        whatsappLink: store.settings.whatsappLink,
        roomInfo: store.roomInfo,
      });
    }

    // Real Razorpay signature verification
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      reg.paymentStatus = 'failed';
      return res.status(400).json({ verified: false, error: 'Payment verification failed' });
    }

    reg.paymentStatus = 'verified';
    reg.txnId = razorpay_payment_id;

    return res.status(200).json({
      verified: true,
      registration: reg,
      whatsappLink: store.settings.whatsappLink,
      roomInfo: store.roomInfo,
    });

  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
