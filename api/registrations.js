const store = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // GET — list registrations (with optional filters)
  if (req.method === 'GET') {
    const { status, date, search, email } = req.query;
    let data = [...store.registrations];

    if (email) {
      const reg = data.find(r => r.leaderEmail === email.toLowerCase());
      return res.status(200).json({ registration: reg || null });
    }

    if (status && status !== 'all') data = data.filter(r => r.paymentStatus === status);
    if (date) data = data.filter(r => r.date === date);
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(r =>
        r.teamName.toLowerCase().includes(s) ||
        r.leaderName.toLowerCase().includes(s) ||
        r.teamTag.toLowerCase().includes(s)
      );
    }

    const total = store.registrations.length;
    const paid = store.registrations.filter(r => r.paymentStatus === 'verified').length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = store.registrations.filter(r => r.date === todayStr).length;

    return res.status(200).json({
      registrations: data,
      stats: { total, paid, pending: total - paid, today: todayCount },
    });
  }

  // PATCH — update registration (verify/reject)
  if (req.method === 'PATCH') {
    const { id, action } = req.body;
    if (!id || !action) return res.status(400).json({ error: 'Missing id or action' });

    const reg = store.registrations.find(r => r.id === id);
    if (!reg) return res.status(404).json({ error: 'Not found' });

    if (action === 'verify') {
      reg.paymentStatus = 'verified';
      reg.txnId = reg.txnId || 'ADMIN_VERIFIED';
    } else if (action === 'reject') {
      reg.paymentStatus = 'pending';
      reg.txnId = '';
    }

    return res.status(200).json({ success: true, registration: reg });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
