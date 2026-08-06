const DEFAULT_CLASSES = [
  { code: 'B09MA1', name: 'Mathematics A1', goal: 85, items: [], order: 0 },
  { code: 'B09SCV', name: 'Science V', goal: 85, items: [], order: 1 },
  { code: 'B09HIV', name: 'History V', goal: 85, items: [], order: 2 },
  { code: 'M09CO22', name: 'ICT: Coding HTML22', goal: 85, items: [], order: 3 },
  { code: 'B09TI21', name: 'ICT: Think ICT21', goal: 85, items: [], order: 4 },
  { code: 'B09EW23', name: 'Art: Exploring our World23', goal: 85, items: [], order: 5 },
  { code: 'B09ENV', name: 'English V', goal: 85, items: [], order: 6 },
  { code: 'B09RE2D', name: 'Religion2D', goal: 85, items: [], order: 7 },
];

// Populates the `classes` collection the first time it's empty. Cheap no-op
// on every call after that (just a countDocuments), so it's safe to call at
// the top of every handler instead of wiring up a separate setup step.
async function ensureSeeded(db) {
  const collection = db.collection('classes');
  const count = await collection.countDocuments();
  if (count === 0) {
    await collection.insertMany(DEFAULT_CLASSES);
  }
}

function stripId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

function makeItemId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

module.exports = { ensureSeeded, stripId, makeItemId, DEFAULT_CLASSES };
