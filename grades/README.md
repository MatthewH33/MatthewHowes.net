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
semester grade). The score is optional — log a test as soon as you know its
weight, and come back to fill in the grade once it's marked. The site will:

- Show a **projected final grade** per class, assuming the rest of the
  semester performs like the average so far.
- Let you set a **goal grade** per class, and tell you the **minimum
  average** needed on the remaining weight to still hit it (or tell you if
  it's already secured, or no longer mathematically possible).
- A **Home** tab showing the **average across all subjects**, and a summary
  card per class.

Data is stored in **MongoDB Atlas** and the whole thing runs as static files
+ serverless functions — no server process to keep running, which fits
Vercel's free (Hobby) tier.

## Project structure

```
gradeledger/
├── api/                          Serverless functions (Vercel Node.js runtime)
│   └── classes/
│       ├── index.js               GET  /api/classes
│       └── [code]/
│           ├── goal.js            PUT  /api/classes/:code/goal
│           └── items/
│               ├── index.js       POST /api/classes/:code/items
│               └── [itemId].js    PUT/DELETE /api/classes/:code/items/:itemId
├── lib/
│   ├── mongodb.js                 Cached MongoDB connection (reused across warm invocations)
│   └── seed.js                    Seeds the 8 classes into MongoDB the first time
├── public/                        Static frontend, served as-is by Vercel
│   ├── index.html
│   ├── style.css
│   └── app.js
├── package.json
├── .env.example                   Template — copy to .env for local dev
└── .env                           Real MongoDB URI (NOT committed — see below)
```

## ⚠️ About the database credentials

`.env` currently has a real MongoDB Atlas username and password in it. That
file is git-ignored so it won't get committed, but:

- **Rotate that password in Atlas** (Database Access → edit user → Edit
  Password) if it's ever been shared anywhere outside this project — Slack,
  email, chat, etc. Anyone with it has full read/write on the database.
- Never put the connection string in `public/` or any file that ships to the
  browser. Everything in `api/` and `lib/` runs only on Vercel's servers —
  the browser never sees it.

## Deploying on Vercel (free tier)

1. Push this folder to a GitHub repo, or run `npx vercel` from inside it to
   deploy directly from your machine.
2. In the Vercel dashboard → your project → **Settings → Environment
   Variables**, add:
   - `MONGODB_URI` — the full `mongodb+srv://...` connection string
   - `MONGODB_DB_NAME` — `gradeledger` (or whatever you'd like)
3. Deploy (push to GitHub, or run `npx vercel --prod`).

That's it — Vercel automatically serves everything in `public/` as static
files and everything in `api/` as serverless functions. No build step, no
server to manage.

## Running it locally

```bash
cd gradeledger
npm install
npx vercel dev
```

`vercel dev` reads `.env` automatically and emulates the same static +
serverless setup you get in production. It'll print a local URL (usually
**http://localhost:3000**).

## How the numbers work

- **Contribution** of a graded item = `weight × score / 100`.
- **Current average** = sum of contributions ÷ weight of graded items so far.
- **Projected grade** = current contributions + (remaining weight × current average).
- **Needed average** on the rest = `(goal − current contributions) / remaining weight × 100`.
- **Overall average** (Home tab) = the mean of each class's current/projected
  grade, across whichever classes have at least one graded item.

Each class's weights must add up to 100% or less — the app won't let you add
an item that would push a class over 100%.
