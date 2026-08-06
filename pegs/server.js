const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- helpers ----
function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function findClass(data, code) {
  return data.classes.find(c => c.code === code);
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---- routes ----

// Get everything
app.get('/api/classes', (req, res) => {
  try {
    res.json(readData());
  } catch (err) {
    res.status(500).json({ error: 'Could not read data file.' });
  }
});

// Add a graded item (test / exam) to a class. Score is optional — leave it
// out (or send null) to log a test that hasn't been graded yet.
app.post('/api/classes/:code/items', (req, res) => {
  const { code } = req.params;
  const { name, weight } = req.body;
  let { score } = req.body;
  if (score === undefined) score = null;

  if (!name || typeof weight !== 'number') {
    return res.status(400).json({ error: 'name and weight are required.' });
  }
  if (weight <= 0 || weight > 100) {
    return res.status(400).json({ error: 'weight must be between 0 and 100.' });
  }
  if (score !== null && (typeof score !== 'number' || score < 0 || score > 100)) {
    return res.status(400).json({ error: 'score must be between 0 and 100, or left blank.' });
  }

  const data = readData();
  const cls = findClass(data, code);
  if (!cls) return res.status(404).json({ error: 'Class not found.' });

  const existingWeight = cls.items.reduce((sum, i) => sum + i.weight, 0);
  if (existingWeight + weight > 100) {
    return res.status(400).json({
      error: `That would put this class over 100% weight (already at ${existingWeight}%).`
    });
  }

  const item = { id: makeId(), name, weight, score };
  cls.items.push(item);
  writeData(data);
  res.status(201).json(item);
});

// Update an item (e.g. filling in a score that was left blank earlier)
app.put('/api/classes/:code/items/:itemId', (req, res) => {
  const { code, itemId } = req.params;
  const { name, weight, score } = req.body;

  const data = readData();
  const cls = findClass(data, code);
  if (!cls) return res.status(404).json({ error: 'Class not found.' });

  const item = cls.items.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const otherWeight = cls.items.filter(i => i.id !== itemId).reduce((s, i) => s + i.weight, 0);
  const newWeight = typeof weight === 'number' ? weight : item.weight;
  if (otherWeight + newWeight > 100) {
    return res.status(400).json({ error: 'That would put this class over 100% weight.' });
  }
  if (score !== undefined && score !== null && (typeof score !== 'number' || score < 0 || score > 100)) {
    return res.status(400).json({ error: 'score must be between 0 and 100, or left blank.' });
  }

  if (name != null) item.name = name;
  if (typeof weight === 'number') item.weight = weight;
  if (score !== undefined) item.score = score; // allows setting a score, or clearing it back to null

  writeData(data);
  res.json(item);
});

// Delete an item
app.delete('/api/classes/:code/items/:itemId', (req, res) => {
  const { code, itemId } = req.params;
  const data = readData();
  const cls = findClass(data, code);
  if (!cls) return res.status(404).json({ error: 'Class not found.' });

  const before = cls.items.length;
  cls.items = cls.items.filter(i => i.id !== itemId);
  if (cls.items.length === before) return res.status(404).json({ error: 'Item not found.' });

  writeData(data);
  res.status(204).end();
});

// Set the goal grade for a class
app.put('/api/classes/:code/goal', (req, res) => {
  const { code } = req.params;
  const { goal } = req.body;
  if (typeof goal !== 'number' || goal < 0 || goal > 100) {
    return res.status(400).json({ error: 'goal must be a number between 0 and 100.' });
  }
  const data = readData();
  const cls = findClass(data, code);
  if (!cls) return res.status(404).json({ error: 'Class not found.' });

  cls.goal = goal;
  writeData(data);
  res.json(cls);
});

app.listen(PORT, () => {
  console.log(`Grade Ledger running at http://localhost:${PORT}`);
});
