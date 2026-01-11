import { MongoClient } from 'mongodb';

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
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

export async function getDatabase() {
    const client = await clientPromise;
    return client.db('phillysports');
}

export async function getCollection(collectionName) {
    const db = await getDatabase();
    return db.collection(collectionName);
}

export { clientPromise };
