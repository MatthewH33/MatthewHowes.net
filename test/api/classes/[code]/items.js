const { getDb } = require('../../../lib/mongodb');
const { ensureSeeded, makeItemId } = require('../../../lib/seed');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { code } = req.query;
  const { name, weight } = req.body || {};
  let { score } = req.body || {};
  if (score === undefined) score = null;

  if (!name || typeof weight !== 'number' || Number.isNaN(weight)) {
    return res.status(400).json({ error: 'name and weight are required.' });
  }
  if (weight <= 0 || weight > 100) {
    return res.status(400).json({ error: 'weight must be between 0 and 100.' });
  }
  if (score !== null && (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 100)) {
    return res.status(400).json({ error: 'score must be between 0 and 100, or left blank.' });
  }

  try {
    const db = await getDb();
    await ensureSeeded(db);
    const collection = db.collection('classes');

    const cls = await collection.findOne({ code });
    if (!cls) return res.status(404).json({ error: 'Class not found.' });

    const existingWeight = (cls.items || []).reduce((sum, i) => sum + i.weight, 0);
    if (existingWeight + weight > 100) {
      return res.status(400).json({
        error: `That would put this class over 100% weight (already at ${existingWeight}%).`,
      });
    }

    const item = { id: makeItemId(), name, weight, score };
    await collection.updateOne({ code }, { $push: { items: item } });

    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add the item.' });
  }
};
