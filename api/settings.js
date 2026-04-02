const store = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // GET — public settings (entry fee, key id for checkout)
  if (req.method === 'GET') {
    return res.status(200).json({
      entryFee: store.settings.entryFee,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_MOCK',
      mockMode: !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_MOCK',
      whatsappLink: store.settings.whatsappLink,
      roomInfo: store.roomInfo,
    });
  }

  // POST — admin updates
  if (req.method === 'POST') {
    const { type } = req.body;

    if (type === 'payment') {
      if (req.body.entryFee) store.settings.entryFee = parseInt(req.body.entryFee);
      if (req.body.upiId) store.settings.upiId = req.body.upiId;
      return res.status(200).json({ success: true, settings: store.settings });
    }

    if (type === 'whatsapp') {
      if (req.body.whatsappLink) store.settings.whatsappLink = req.body.whatsappLink;
      return res.status(200).json({ success: true, whatsappLink: store.settings.whatsappLink });
    }

    if (type === 'room') {
      store.roomInfo = {
        roomId: req.body.roomId || '',
        roomPass: req.body.roomPass || '',
        roomMessage: req.body.roomMessage || '',
      };
      return res.status(200).json({ success: true, roomInfo: store.roomInfo });
    }

    if (type === 'clearRoom') {
      store.roomInfo = { roomId: '', roomPass: '', roomMessage: '' };
      return res.status(200).json({ success: true, roomInfo: store.roomInfo });
    }

    if (type === 'adminLogin') {
      const { password } = req.body;
      if (password === store.adminPassword) {
        return res.status(200).json({ success: true });
      }
      return res.status(401).json({ error: 'Wrong password' });
    }

    return res.status(400).json({ error: 'Unknown type' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
