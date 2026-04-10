const { db } = require('./_firebase');
const { requireAdmin } = require('./_adminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    const { email } = req.query;

    // Public: lookup own registration by email
    if (email) {
      const snap = await db.collection('registrations')
        .where('leaderEmail', '==', email.toLowerCase())
        .limit(1).get();
      const reg = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
      return res.status(200).json({ registration: reg });
    }

    // Admin-only: list all registrations
    const adminUser = requireAdmin(req);
    if (!adminUser) {
      return res.status(401).json({ error: 'Unauthorized — admin login required' });
    }

    const { status, date, search, tournamentId } = req.query;
    let query = db.collection('registrations').orderBy('date', 'desc');

    const allSnap = await query.get();
    let data = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (status && status !== 'all') data = data.filter(r => r.paymentStatus === status);
    if (date) data = data.filter(r => r.date === date || r.tournamentDate === date);
    if (tournamentId) data = data.filter(r => r.tournamentId === tournamentId);
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(r =>
        (r.teamName || '').toLowerCase().includes(s) ||
        (r.leaderName || '').toLowerCase().includes(s) ||
        (r.teamTag || '').toLowerCase().includes(s)
      );
    }

    const total = allSnap.size;
    const paid = allSnap.docs.filter(d => d.data().paymentStatus === 'verified').length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = allSnap.docs.filter(d => d.data().date === todayStr).length;

    return res.status(200).json({
      registrations: data,
      stats: { total, paid, pending: total - paid, today: todayCount },
    });
  }

  if (req.method === 'PATCH') {
    const adminUser = requireAdmin(req);
    if (!adminUser) {
      return res.status(401).json({ error: 'Unauthorized — admin login required' });
    }

    const { id, action } = req.body;
    if (!id || !action) return res.status(400).json({ error: 'Missing id or action' });

    const ref = db.collection('registrations').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });

    if (action === 'verify') {
      await ref.update({ paymentStatus: 'verified', txnId: snap.data().txnId || 'ADMIN_VERIFIED' });
    } else if (action === 'reject') {
      await ref.update({ paymentStatus: 'pending', txnId: '' });
    }

    const updated = await ref.get();
    return res.status(200).json({ success: true, registration: { id: updated.id, ...updated.data() } });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
