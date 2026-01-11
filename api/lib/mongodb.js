const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

let client;
let clientPromise;

if (!uri) {
    throw new Error('Please add your MongoDB URI to environment variables');
}

if (process.env.NODE_ENV === 'development') {
    // In development, use a global variable to preserve the client across hot reloads
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    // In production, create a new client for each connection
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

async function getDatabase() {
    const client = await clientPromise;
    return client.db('phillysports');
}

async function getCollection(collectionName) {
    const db = await getDatabase();
    return db.collection(collectionName);
}

module.exports = { clientPromise, getDatabase, getCollection };
