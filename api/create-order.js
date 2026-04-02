const Razorpay = require('razorpay');
const store = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { teamName, teamTag, leaderName, leaderWhatsApp, leaderEmail, players, substitute } = req.body;

    if (!teamName || !leaderEmail || !players || players.length < 4) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = store.registrations.find(r => r.leaderEmail === leaderEmail.toLowerCase());
    if (existing) {
      return res.status(200).json({
        existing: true,
        registration: existing,
        message: 'Already registered with this email',
      });
    }

    const amount = (store.settings.entryFee || 100) * 100; // paise

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
          notes: { teamName, leaderEmail },
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
      id: 'reg_' + Date.now(),
      teamName,
      teamTag: teamTag || '',
      leaderName,
      leaderWhatsApp: leaderWhatsApp || '',
      leaderEmail: leaderEmail.toLowerCase(),
      players,
      substitute: substitute || { ign: '', bgmiId: '' },
      paymentStatus: 'pending',
      txnId: '',
      payNote: '',
      orderId: order.id,
      date: new Date().toISOString().split('T')[0],
    };

    store.registrations.push(reg);

    return res.status(200).json({
      existing: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_MOCK',
      registration: reg,
      mockMode: MOCK_MODE,
    });

  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
