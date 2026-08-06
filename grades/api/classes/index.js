const { getDb } = require('../../lib/mongodb');
const { ensureSeeded, stripId } = require('../../lib/seed');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const db = await getDb();
    await ensureSeeded(db);
    const docs = await db.collection('classes').find({}).sort({ order: 1 }).toArray();
    res.status(200).json({ classes: docs.map(stripId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load classes from the database.' });
  }
};
