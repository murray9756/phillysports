import { MongoClient } from 'mongodb';

const uri = "PASTE_YOUR_MONGODB_URI_HERE";

async function linkEmail() {
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        const db = client.db();
        const users = db.collection('users');
        
        const user = await users.findOne({ isAdmin: true });
        
        if (!user) {
            console.log('Admin user not found');
            return;
        }
        
        console.log('Found user:', user.username, user._id.toString());
        
        const result = await users.updateOne(
            { _id: user._id },
            { 
                $set: { 
                    premiumEmail: {
                        prefix: 'kevin',
                        email: 'kevin@phillysports.com',
                        zohoAccountId: '6751363000000008001',
                        createdAt: new Date(),
                        status: 'active'
                    },
                    isSubscribed: true,
                    subscriptionTier: 'premium',
                    updatedAt: new Date()
                }
            }
        );
        
        console.log('Updated:', result.modifiedCount, 'document(s)');
        
    } finally {
        await client.close();
    }
}

linkEmail().catch(console.error);
