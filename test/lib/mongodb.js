const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'gradeledger';

if (!uri) {
  throw new Error('Missing MONGODB_URI environment variable.');
}

// In serverless environments the module scope can be reused between warm
// invocations of the same function instance, so we cache the connection
// promise on the global object to avoid opening a new connection on every
// request (which would quickly exhaust Atlas's connection limit).
let cachedPromise = global._mongoClientPromise;

if (!cachedPromise) {
  const client = new MongoClient(uri, {
    maxPoolSize: 5, // keep it small — serverless functions run many small instances
  });
  cachedPromise = client.connect();
  global._mongoClientPromise = cachedPromise;
}

async function getDb() {
  const client = await cachedPromise;
  return client.db(dbName);
}

module.exports = { getDb };
