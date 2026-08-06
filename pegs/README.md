# Grade Ledger

A personal grade-tracking site for one student, covering:

- Mathematics A1 (B09MA1)
- Science V (B09SCV)
- History V (B09HIV)
- ICT: Coding HTML22 (M09CO22)
- ICT: Think ICT21 (B09TI21)
- Art: Exploring our World23 (B09EW23)
- English V (B09ENV)
- Religion2D (B09RE2D)

For each class you can log tests/exams with their weight (out of 100% of the
semester grade). The score is optional — you can log a test as soon as you
know its weight, and come back to fill in the grade once it's marked. Pending
items sit in the ledger tagged "pending" with a quick inline field to add the
grade later. The site will:

- Show a **projected final grade**, assuming the rest of the semester
  performs like the average so far.
- Let you set a **goal grade**, and tell you the **minimum average** you
  need on the remaining weight to still hit it (or tell you if it's already
  secured, or no longer mathematically possible).

Everything is saved to `data.json` on the server, so it persists between visits.

## Running it

Requires [Node.js](https://nodejs.org) (v18+ recommended).

```bash
cd gradeledger
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

## How the numbers work

- **Contribution** of an item = `weight × score / 100`.
- **Current average** = sum of contributions ÷ weight entered so far.
- **Projected grade** = current contributions + (remaining weight × current average).
- **Needed average** on the rest = `(goal − current contributions) / remaining weight × 100`.

## Project structure

```
gradeledger/
├── server.js        Express backend + JSON file storage
├── data.json         Saved grade data (auto-updated)
├── package.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

Each class's weights must add up to 100% or less — the app won't let you add
an item that would push a class over 100%.
