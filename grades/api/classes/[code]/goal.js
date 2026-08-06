const { getDb } = require('../../../lib/mongodb');
const { ensureSeeded, stripId } = require('../../../lib/seed');

module.exports = async (req, res) => {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { code } = req.query;
  const { goal } = req.body || {};

  if (typeof goal !== 'number' || Number.isNaN(goal) || goal < 0 || goal > 100) {
    return res.status(400).json({ error: 'goal must be a number between 0 and 100.' });
  }

  try {
    const db = await getDb();
    await ensureSeeded(db);
    const collection = db.collection('classes');

    const result = await collection.findOneAndUpdate(
      { code },
      { $set: { goal } },
      { returnDocument: 'after' }
    );

    const updated = result && result.value ? result.value : result; // driver-version safety
    if (!updated) return res.status(404).json({ error: 'Class not found.' });

    res.status(200).json(stripId(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update the goal.' });
  }
};
