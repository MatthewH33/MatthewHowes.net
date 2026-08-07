const { getDb } = require('../../../../lib/mongodb');
const { ensureSeeded, stripId } = require('../../../../lib/seed');

module.exports = async (req, res) => {
  const { code, itemId } = req.query;

  try {
    const db = await getDb();
    await ensureSeeded(db);
    const collection = db.collection('classes');

    if (req.method === 'PUT') {
      const { name, weight, score } = req.body || {};

      const cls = await collection.findOne({ code });
      if (!cls) return res.status(404).json({ error: 'Class not found.' });

      const item = (cls.items || []).find(i => i.id === itemId);
      if (!item) return res.status(404).json({ error: 'Item not found.' });

      const otherWeight = (cls.items || [])
        .filter(i => i.id !== itemId)
        .reduce((s, i) => s + i.weight, 0);
      const newWeight = typeof weight === 'number' ? weight : item.weight;
      if (otherWeight + newWeight > 100) {
        return res.status(400).json({ error: 'That would put this class over 100% weight.' });
      }
      if (score !== undefined && score !== null &&
          (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 100)) {
        return res.status(400).json({ error: 'score must be between 0 and 100, or left blank.' });
      }

      const updatedItem = { ...item };
      if (name != null) updatedItem.name = name;
      if (typeof weight === 'number') updatedItem.weight = weight;
      if (score !== undefined) updatedItem.score = score; // set a grade, or clear it back to null

      await collection.updateOne(
        { code, 'items.id': itemId },
        { $set: { 'items.$': updatedItem } }
      );

      return res.status(200).json(updatedItem);
    }

    if (req.method === 'DELETE') {
      const result = await collection.updateOne(
        { code },
        { $pull: { items: { id: itemId } } }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Class not found.' });
      if (result.modifiedCount === 0) return res.status(404).json({ error: 'Item not found.' });
      return res.status(204).end();
    }

    res.setHeader('Allow', 'PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating that item.' });
  }
};
